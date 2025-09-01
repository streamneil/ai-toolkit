import Link from 'next/link';
import { Eye, Trash2, Pen, Play, Pause } from 'lucide-react';
import { Button } from '@headlessui/react';
import { openConfirm } from '@/components/ConfirmModal';
import { Job } from '@prisma/client';
import { startJob, stopJob, deleteJob, getAvaliableJobActions } from '@/utils/jobs';

interface JobActionBarProps {
  job: Job;
  onRefresh?: () => void;
  afterDelete?: () => void;
  hideView?: boolean;
  className?: string;
}

export default function JobActionBar({ job, onRefresh, afterDelete, className, hideView }: JobActionBarProps) {
  const { canStart, canStop, canDelete, canEdit } = getAvaliableJobActions(job);

  if (!afterDelete) afterDelete = onRefresh;

  return (
    <div className={`${className}`}>
      {canStart && (
        <Button
          onClick={async () => {
            if (!canStart) return;
            await startJob(job.id);
            if (onRefresh) onRefresh();
          }}
          className={`ml-2 opacity-100`}
        >
          <Play />
        </Button>
      )}
      {canStop && (
        <Button
          onClick={() => {
            if (!canStop) return;
            openConfirm({
              title: '停止任务',
              message: `您确定要停止任务 "${job.name}" 吗？您可以稍后恢复。`,
              type: 'info',
              confirmText: '停止',
              onConfirm: async () => {
                await stopJob(job.id);
                if (onRefresh) onRefresh();
              },
            });
          }}
          className={`ml-2 opacity-100`}
        >
          <Pause />
        </Button>
      )}
      {!hideView && (
        <Link href={`/jobs/${job.id}`} className="ml-2 text-gray-200 hover:text-gray-100 inline-block">
          <Eye />
        </Link>
      )}
      {canEdit && (
        <Link href={`/jobs/new?id=${job.id}`} className="ml-2 hover:text-gray-100 inline-block">
          <Pen />
        </Link>
      )}
      <Button
        onClick={() => {
          let message = `您确定要删除任务 "${job.name}" 吗？这也将从您的磁盘中永久删除它。`;
          if (job.status === 'running') {
            message += ' 警告：任务目前正在运行。如果可能，您应该先停止它。';
          }
          openConfirm({
            title: '删除任务',
            message: message,
            type: 'warning',
            confirmText: '删除',
            onConfirm: async () => {
              if (job.status === 'running') {
                try {
                  await stopJob(job.id);
                } catch (e) {
                  console.error('Error stopping job before deleting:', e);
                }
              }
              await deleteJob(job.id);
              if (afterDelete) afterDelete();
            },
          });
        }}
        className={`ml-2 opacity-100`}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
