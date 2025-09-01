'use client';
import { useMemo } from 'react';
import { modelArchs, ModelArch, groupedModelOptions, quantizationOptions, defaultQtype } from './options';
import { defaultDatasetConfig } from './jobConfig';
import { GroupedSelectOption, JobConfig, SelectOption } from '@/types';
import { objectCopy } from '@/utils/basic';
import { TextInput, SelectInput, Checkbox, FormGroup, NumberInput } from '@/components/formInputs';
import Card from '@/components/Card';
import { X } from 'lucide-react';
import AddSingleImageModal, { openAddImageModal } from '@/components/AddSingleImageModal';
import {FlipHorizontal2, FlipVertical2} from "lucide-react"

type Props = {
  jobConfig: JobConfig;
  setJobConfig: (value: any, key: string) => void;
  status: 'idle' | 'saving' | 'success' | 'error';
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  runId: string | null;
  gpuIDs: string | null;
  setGpuIDs: (value: string | null) => void;
  gpuList: any;
  datasetOptions: any;
};

const isDev = process.env.NODE_ENV === 'development';

export default function SimpleJob({
  jobConfig,
  setJobConfig,
  handleSubmit,
  status,
  runId,
  gpuIDs,
  setGpuIDs,
  gpuList,
  datasetOptions,
}: Props) {
  const modelArch = useMemo(() => {
    return modelArchs.find(a => a.name === jobConfig.config.process[0].model.arch) as ModelArch;
  }, [jobConfig.config.process[0].model.arch]);

  const isVideoModel = !!(modelArch?.group === 'video');

  const numTopCards = useMemo(() => {
    let count = 4; // job settings, model config, target config, save config
    if (modelArch?.additionalSections?.includes('model.multistage')) {
      count += 1; // add multistage card
    }
    if (!modelArch?.disableSections?.includes('model.quantize')) {
      count += 1; // add quantization card
    }
    return count;
    
  }, [modelArch]);

  let topBarClass = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6';

  if (numTopCards == 5) {
    topBarClass = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6';
  }
  if (numTopCards == 6) {
    topBarClass = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-6';
  }

  const transformerQuantizationOptions: GroupedSelectOption[] | SelectOption[] = useMemo(() => {
    const hasARA = modelArch?.accuracyRecoveryAdapters && Object.keys(modelArch.accuracyRecoveryAdapters).length > 0;
    if (!hasARA) {
      return quantizationOptions;
    }
    let newQuantizationOptions = [
      {
        label: 'Standard',
        options: [quantizationOptions[0], quantizationOptions[1]],
      },
    ];

    // add ARAs if they exist for the model
    let ARAs: SelectOption[] = [];
    if (modelArch.accuracyRecoveryAdapters) {
      for (const [label, value] of Object.entries(modelArch.accuracyRecoveryAdapters)) {
         ARAs.push({ value, label });
      }
    }
    if (ARAs.length > 0) {
      newQuantizationOptions.push({
        label: 'Accuracy Recovery Adapters',
        options: ARAs,
      });
    }

    let additionalQuantizationOptions: SelectOption[] = [];
    // add the quantization options if they are not already included
    for (let i = 2; i < quantizationOptions.length; i++) {
      const option = quantizationOptions[i];
      additionalQuantizationOptions.push(option);
    }
    if (additionalQuantizationOptions.length > 0) {
      newQuantizationOptions.push({
        label: 'Additional Quantization Options',
        options: additionalQuantizationOptions,
      });
    }
    return newQuantizationOptions;
  }, [modelArch]);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className={topBarClass}>
          <Card title="任务(Job)">
            <TextInput
              label="训练名称(Training Name)"
              value={jobConfig.config.name}
              docKey="config.name"
              onChange={value => setJobConfig(value, 'config.name')}
              placeholder="输入训练名称"
              disabled={runId !== null}
              required
            />
            <SelectInput
              label="GPU ID"
              value={`${gpuIDs}`}
              docKey="gpuids"
              onChange={value => setGpuIDs(value)}
              options={gpuList.map((gpu: any) => ({ value: `${gpu.index}`, label: `GPU #${gpu.index}` }))}
            />
            <TextInput
              label="触发词(Trigger Word)"
              value={jobConfig.config.process[0].trigger_word || ''}
              docKey="config.process[0].trigger_word"
              onChange={(value: string | null) => {
                if (value?.trim() === '') {
                  value = null;
                }
                setJobConfig(value, 'config.process[0].trigger_word');
              }}
              placeholder=""
              required
            />
          </Card>

          {/* Model Configuration Section */}
          <Card title="模型(Model)">
            <SelectInput
              label="模型架构(Model Architecture)"
              value={jobConfig.config.process[0].model.arch}
              onChange={value => {
                const currentArch = modelArchs.find(a => a.name === jobConfig.config.process[0].model.arch);
                if (!currentArch || currentArch.name === value) {
                  return;
                }
                // update the defaults when a model is selected
                const newArch = modelArchs.find(model => model.name === value);

                // update vram setting
                if (!newArch?.additionalSections?.includes('model.low_vram')) {
                  setJobConfig(false, 'config.process[0].model.low_vram');
                }

                // revert defaults from previous model
                for (const key in currentArch.defaults) {
                  setJobConfig(currentArch.defaults[key][1], key);
                }

                if (newArch?.defaults) {
                  for (const key in newArch.defaults) {
                    setJobConfig(newArch.defaults[key][0], key);
                  }
                }
                // set new model
                setJobConfig(value, 'config.process[0].model.arch');

                // update datasets
                const hasControlPath = newArch?.additionalSections?.includes('datasets.control_path') || false;
                const hasNumFrames = newArch?.additionalSections?.includes('datasets.num_frames') || false;
                const controls = newArch?.controls ?? [];
                const datasets = jobConfig.config.process[0].datasets.map(dataset => {
                  const newDataset = objectCopy(dataset);
                  newDataset.controls = controls;
                  if (!hasControlPath) {
                    newDataset.control_path = null; // reset control path if not applicable
                  }
                  if (!hasNumFrames) {
                    newDataset.num_frames = 1; // reset num_frames if not applicable
                  }
                  return newDataset;
                });
                setJobConfig(datasets, 'config.process[0].datasets');

                // update samples
                const hasSampleCtrlImg = newArch?.additionalSections?.includes('sample.ctrl_img') || false;
                const samples = jobConfig.config.process[0].sample.samples.map(sample => {
                  const newSample = objectCopy(sample);
                  if (!hasSampleCtrlImg) {
                    delete newSample.ctrl_img; // remove ctrl_img if not applicable
                  }
                  return newSample;
                });
                setJobConfig(samples, 'config.process[0].sample.samples');
              }}
              options={groupedModelOptions}
            />
            <TextInput
              label="名称或路径(Name or Path)"
              value={jobConfig.config.process[0].model.name_or_path}
              docKey="config.process[0].model.name_or_path"
              onChange={(value: string | null) => {
                if (value?.trim() === '') {
                  value = null;
                }
                setJobConfig(value, 'config.process[0].model.name_or_path');
              }}
              placeholder=""
              required
            />
            {modelArch?.additionalSections?.includes('model.low_vram') && (
              <FormGroup label="Options">
                <Checkbox
                  label="低显存(Low VRAM)"
                  checked={jobConfig.config.process[0].model.low_vram}
                  onChange={value => setJobConfig(value, 'config.process[0].model.low_vram')}
                />
              </FormGroup>
            )}
          </Card>
          {modelArch?.disableSections?.includes('model.quantize') ? null : (
            <Card title="量化(Quantization)">
              <SelectInput
                label="变换器(Transformer)"
                value={jobConfig.config.process[0].model.quantize ? jobConfig.config.process[0].model.qtype : ''}
                onChange={value => {
                  if (value === '') {
                    setJobConfig(false, 'config.process[0].model.quantize');
                    value = defaultQtype;
                  } else {
                    setJobConfig(true, 'config.process[0].model.quantize');
                  }
                  setJobConfig(value, 'config.process[0].model.qtype');
                }}
                options={transformerQuantizationOptions}
              />
              <SelectInput
                label="文本编码器(Text Encoder)"
                value={jobConfig.config.process[0].model.quantize_te ? jobConfig.config.process[0].model.qtype_te : ''}
                onChange={value => {
                  if (value === '') {
                    setJobConfig(false, 'config.process[0].model.quantize_te');
                    value = defaultQtype;
                  } else {
                    setJobConfig(true, 'config.process[0].model.quantize_te');
                  }
                  setJobConfig(value, 'config.process[0].model.qtype_te');
                }}
                options={quantizationOptions}
              />
            </Card>
          )}
          {modelArch?.additionalSections?.includes('model.multistage') && (
            <Card title="多阶段(Multistage)">
              <FormGroup label="训练阶段(Stages to Train)" docKey={'model.multistage'}>
                <Checkbox
                  label="高噪声(High Noise)"
                  checked={jobConfig.config.process[0].model.model_kwargs?.train_high_noise || false}
                  onChange={value => setJobConfig(value, 'config.process[0].model.model_kwargs.train_high_noise')}
                />
                <Checkbox
                  label="低噪声(Low Noise)"
                  checked={jobConfig.config.process[0].model.model_kwargs?.train_low_noise || false}
                  onChange={value => setJobConfig(value, 'config.process[0].model.model_kwargs.train_low_noise')}
                />
              </FormGroup>
              <NumberInput
                  label="切换频率(Switch Every)"
                  value={jobConfig.config.process[0].train.switch_boundary_every}
                  onChange={value => setJobConfig(value, 'config.process[0].train.switch_boundary_every')}
                  placeholder="eg. 1"
                  docKey={'train.switch_boundary_every'}
                  min={1}
                  required
                />
            </Card>
          )}
          <Card title="目标(Target)">
            <SelectInput
              label="目标类型(Target Type)"
              value={jobConfig.config.process[0].network?.type ?? 'lora'}
              onChange={value => setJobConfig(value, 'config.process[0].network.type')}
              options={[
                { value: 'lora', label: 'LoRA' },
                { value: 'lokr', label: 'LoKr' },
              ]}
            />
            {jobConfig.config.process[0].network?.type == 'lokr' && (
              <SelectInput
                label="LoKr 因子(LoKr Factor)"
                value={`${jobConfig.config.process[0].network?.lokr_factor ?? -1}`}
                onChange={value => setJobConfig(parseInt(value), 'config.process[0].network.lokr_factor')}
                options={[
                  { value: '-1', label: '自动(Auto)' },
                  { value: '4', label: '4' },
                  { value: '8', label: '8' },
                  { value: '16', label: '16' },
                  { value: '32', label: '32' },
                ]}
              />
            )}
            {jobConfig.config.process[0].network?.type == 'lora' && (
              <>
                <NumberInput
                  label="线性秩(Linear Rank)"
                  value={jobConfig.config.process[0].network.linear}
                  onChange={value => {
                    console.log('onChange', value);
                    setJobConfig(value, 'config.process[0].network.linear');
                    setJobConfig(value, 'config.process[0].network.linear_alpha');
                  }}
                  placeholder="eg. 16"
                  min={0}
                  max={1024}
                  required
                />
                {modelArch?.disableSections?.includes('network.conv') ? null : (
                  <NumberInput
                    label="卷积秩(Conv Rank)"
                    value={jobConfig.config.process[0].network.conv}
                    onChange={value => {
                      console.log('onChange', value);
                      setJobConfig(value, 'config.process[0].network.conv');
                      setJobConfig(value, 'config.process[0].network.conv_alpha');
                    }}
                    placeholder="eg. 16"
                    min={0}
                    max={1024}
                  />
                )}
              </>
            )}
          </Card>
          <Card title="保存(Save)">
            <SelectInput
              label="数据类型(Data Type)"
              value={jobConfig.config.process[0].save.dtype}
              onChange={value => setJobConfig(value, 'config.process[0].save.dtype')}
              options={[
                { value: 'bf16', label: 'BF16' },
                { value: 'fp16', label: 'FP16' },
                { value: 'fp32', label: 'FP32' },
              ]}
            />
            <NumberInput
              label="保存频率(Save Every)"
              value={jobConfig.config.process[0].save.save_every}
              onChange={value => setJobConfig(value, 'config.process[0].save.save_every')}
              placeholder="eg. 250"
              min={1}
              required
            />
            <NumberInput
              label="最大保留步数(Max Step Saves to Keep)"
              value={jobConfig.config.process[0].save.max_step_saves_to_keep}
              onChange={value => setJobConfig(value, 'config.process[0].save.max_step_saves_to_keep')}
              placeholder="eg. 4"
              min={1}
              required
            />
          </Card>
        </div>
        <div>
          <Card title="训练(Training)">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <div>
                <NumberInput
                  label="批大小(Batch Size)"
                  value={jobConfig.config.process[0].train.batch_size}
                  onChange={value => setJobConfig(value, 'config.process[0].train.batch_size')}
                  placeholder="eg. 4"
                  min={1}
                  required
                />
                <NumberInput
                  label="梯度累积(Gradient Accumulation)"
                  className="pt-2"
                  value={jobConfig.config.process[0].train.gradient_accumulation}
                  onChange={value => setJobConfig(value, 'config.process[0].train.gradient_accumulation')}
                  placeholder="eg. 1"
                  min={1}
                  required
                />
                <NumberInput
                  label="步数(Steps)"
                  className="pt-2"
                  value={jobConfig.config.process[0].train.steps}
                  onChange={value => setJobConfig(value, 'config.process[0].train.steps')}
                  placeholder="eg. 2000"
                  min={1}
                  required
                />
              </div>
              <div>
                <SelectInput
                  label="优化器(Optimizer)"
                  value={jobConfig.config.process[0].train.optimizer}
                  onChange={value => setJobConfig(value, 'config.process[0].train.optimizer')}
                  options={[
                    { value: 'adamw8bit', label: 'AdamW8Bit' },
                    { value: 'adafactor', label: 'Adafactor' },
                  ]}
                />
                <NumberInput
                  label="学习率(Learning Rate)"
                  className="pt-2"
                  value={jobConfig.config.process[0].train.lr}
                  onChange={value => setJobConfig(value, 'config.process[0].train.lr')}
                  placeholder="eg. 0.0001"
                  min={0}
                  required
                />
                <NumberInput
                  label="权重衰减(Weight Decay)"
                  className="pt-2"
                  value={jobConfig.config.process[0].train.optimizer_params.weight_decay}
                  onChange={value => setJobConfig(value, 'config.process[0].train.optimizer_params.weight_decay')}
                  placeholder="eg. 0.0001"
                  min={0}
                  required
                />
              </div>
              <div>
                {modelArch?.disableSections?.includes('train.timestep_type') ? null : (
                  <SelectInput
                    label="时间步类型(Timestep Type)"
                    value={jobConfig.config.process[0].train.timestep_type}
                    disabled={modelArch?.disableSections?.includes('train.timestep_type') || false}
                    onChange={value => setJobConfig(value, 'config.process[0].train.timestep_type')}
                    options={[
                      { value: 'sigmoid', label: '鹰形函数(Sigmoid)' },
                      { value: 'linear', label: '线性(Linear)' },
                      { value: 'shift', label: '偏移(Shift)' },
                      { value: 'weighted', label: '加权(Weighted)' },
                    ]}
                  />
                )}
                <SelectInput
                  label="时间步偏向(Timestep Bias)"
                  className="pt-2"
                  value={jobConfig.config.process[0].train.content_or_style}
                  onChange={value => setJobConfig(value, 'config.process[0].train.content_or_style')}
                  options={[
                    { value: 'balanced', label: '平衡(Balanced)' },
                    { value: 'content', label: '高噪声(High Noise)' },
                    { value: 'style', label: '低噪声(Low Noise)' },
                  ]}
                />
                <SelectInput
                  label="噪声调度器(Noise Scheduler)"
                  className="pt-2"
                  value={jobConfig.config.process[0].train.noise_scheduler}
                  onChange={value => setJobConfig(value, 'config.process[0].train.noise_scheduler')}
                  options={[
                    { value: 'flowmatch', label: 'FlowMatch' },
                    { value: 'ddpm', label: 'DDPM' },
                  ]}
                />
              </div>
              <div>
                <FormGroup label="指数移动平均(EMA)">
                  <Checkbox
                    label="使用 EMA(Use EMA)"
                    className="pt-1"
                    checked={jobConfig.config.process[0].train.ema_config?.use_ema || false}
                    onChange={value => setJobConfig(value, 'config.process[0].train.ema_config.use_ema')}
                  />
                </FormGroup>
                {jobConfig.config.process[0].train.ema_config?.use_ema && (
                  <NumberInput
                    label="EMA 衰减(EMA Decay)"
                    className="pt-2"
                    value={jobConfig.config.process[0].train.ema_config?.ema_decay as number}
                    onChange={value => setJobConfig(value, 'config.process[0].train.ema_config?.ema_decay')}
                    placeholder="eg. 0.99"
                    min={0}
                  />
                )}

                <FormGroup label="文本编码器优化(Text Encoder Optimizations)" className="pt-2">
                  <Checkbox
                    label="卸载文本编码器(Unload TE)"
                    checked={jobConfig.config.process[0].train.unload_text_encoder || false}
                    docKey={'train.unload_text_encoder'}
                    onChange={value => {
                      setJobConfig(value, 'config.process[0].train.unload_text_encoder');
                      if (value) {
                        setJobConfig(false, 'config.process[0].train.cache_text_embeddings');
                      }
                    }}
                  />
                  <Checkbox
                    label="缓存文本嵌入(Cache Text Embeddings)"
                    checked={jobConfig.config.process[0].train.cache_text_embeddings || false}
                    docKey={'train.cache_text_embeddings'}
                    onChange={value => {
                      setJobConfig(value, 'config.process[0].train.cache_text_embeddings');
                      if (value) {
                        setJobConfig(false, 'config.process[0].train.unload_text_encoder');
                      }
                    }}
                  />
                </FormGroup>
              </div>
              <div>
                <FormGroup label="正则化(Regularization)">
                  <Checkbox
                    label="差分输出保持(Differential Output Preservation)"
                    className="pt-1"
                    checked={jobConfig.config.process[0].train.diff_output_preservation || false}
                    onChange={value => setJobConfig(value, 'config.process[0].train.diff_output_preservation')}
                  />
                </FormGroup>
                {jobConfig.config.process[0].train.diff_output_preservation && (
                  <>
                    <NumberInput
                      label="DOP 损失倍数(DOP Loss Multiplier)"
                      className="pt-2"
                      value={jobConfig.config.process[0].train.diff_output_preservation_multiplier as number}
                      onChange={value =>
                        setJobConfig(value, 'config.process[0].train.diff_output_preservation_multiplier')
                      }
                      placeholder="eg. 1.0"
                      min={0}
                    />
                    <TextInput
                      label="DOP 保持类别(DOP Preservation Class)"
                      className="pt-2"
                      value={jobConfig.config.process[0].train.diff_output_preservation_class as string}
                      onChange={value => setJobConfig(value, 'config.process[0].train.diff_output_preservation_class')}
                      placeholder="eg. woman"
                    />
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
        <div>
          <Card title="数据集(Datasets)">
            <>
              {jobConfig.config.process[0].datasets.map((dataset, i) => (
                <div key={i} className="p-4 rounded-lg bg-gray-800 relative">
                  <button
                    type="button"
                    onClick={() =>
                      setJobConfig(
                        jobConfig.config.process[0].datasets.filter((_, index) => index !== i),
                        'config.process[0].datasets',
                      )
                    }
                    className="absolute top-2 right-2 bg-red-800 hover:bg-red-700 rounded-full p-1 text-sm transition-colors"
                  >
                    <X />
                  </button>
                  <h2 className="text-lg font-bold mb-4">数据集 {i + 1}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <SelectInput
                        label="数据集(Dataset)"
                        value={dataset.folder_path}
                        onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].folder_path`)}
                        options={datasetOptions}
                      />
                      {modelArch?.additionalSections?.includes('datasets.control_path') && (
                        <SelectInput
                          label="控制数据集(Control Dataset)"
                          docKey="datasets.control_path"
                          value={dataset.control_path ?? ''}
                          className="pt-2"
                          onChange={value =>
                            setJobConfig(value == '' ? null : value, `config.process[0].datasets[${i}].control_path`)
                          }
                          options={[{ value: '', label: <>&nbsp;</> }, ...datasetOptions]}
                        />
                      )}
                      <NumberInput
                        label="LoRA 权重(LoRA Weight)"
                        value={dataset.network_weight}
                        className="pt-2"
                        onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].network_weight`)}
                        placeholder="eg. 1.0"
                      />
                    </div>
                    <div>
                      <TextInput
                        label="默认描述(Default Caption)"
                        value={dataset.default_caption}
                        onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].default_caption`)}
                        placeholder="A photo of a cat"
                      />
                      <NumberInput
                        label="描述丢弃率(Caption Dropout Rate)"
                        className="pt-2"
                        value={dataset.caption_dropout_rate}
                        onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].caption_dropout_rate`)}
                        placeholder="eg. 0.05"
                        min={0}
                        required
                      />
                      {modelArch?.additionalSections?.includes('datasets.num_frames') && (
                        <NumberInput
                          label="帧数(Num Frames)"
                          className="pt-2"
                          docKey="datasets.num_frames"
                          value={dataset.num_frames}
                          onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].num_frames`)}
                          placeholder="eg. 41"
                          min={1}
                          required
                        />
                      )}
                    </div>
                    <div>
                      <FormGroup label="设置(Settings)" className="">
                        <Checkbox
                          label="缓存潜在空间(Cache Latents)"
                          checked={dataset.cache_latents_to_disk || false}
                          onChange={value =>
                            setJobConfig(value, `config.process[0].datasets[${i}].cache_latents_to_disk`)
                          }
                        />
                        <Checkbox
                          label="是否为正则化(Is Regularization)"
                          checked={dataset.is_reg || false}
                          onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].is_reg`)}
                        />
                        {modelArch?.additionalSections?.includes('datasets.do_i2v') && (
                          <Checkbox
                            label="图像转视频(Do I2V)"
                            checked={dataset.do_i2v || false}
                            onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].do_i2v`)}
                            docKey="datasets.do_i2v"
                          />
                        )}
                      </FormGroup>
                      <FormGroup label="翻转(Flipping)" docKey={'datasets.flip'} className="mt-2">
                        <Checkbox
                          label={<>Flip X <FlipHorizontal2 className="inline-block w-4 h-4 ml-1" /></>}
                          checked={dataset.flip_x || false}
                          onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].flip_x`)}
                        />
                        <Checkbox
                          label={<>Flip Y <FlipVertical2 className="inline-block w-4 h-4 ml-1" /></>}
                          checked={dataset.flip_y || false}
                          onChange={value => setJobConfig(value, `config.process[0].datasets[${i}].flip_y`)}
                        />
                      </FormGroup>
                    </div>
                    <div>
                      <FormGroup label="分辨率(Resolutions)" className="pt-2">
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            [256, 512, 768],
                            [1024, 1280, 1536],
                          ].map(resGroup => (
                            <div key={resGroup[0]} className="space-y-2">
                              {resGroup.map(res => (
                                <Checkbox
                                  key={res}
                                  label={res.toString()}
                                  checked={dataset.resolution.includes(res)}
                                  onChange={value => {
                                    const resolutions = dataset.resolution.includes(res)
                                      ? dataset.resolution.filter(r => r !== res)
                                      : [...dataset.resolution, res];
                                    setJobConfig(resolutions, `config.process[0].datasets[${i}].resolution`);
                                  }}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </FormGroup>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const newDataset = objectCopy(defaultDatasetConfig);
                  // automaticallt add the controls for a new dataset
                  const controls = modelArch?.controls ?? [];
                  newDataset.controls = controls;
                  setJobConfig([...jobConfig.config.process[0].datasets, newDataset], 'config.process[0].datasets');
                }}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                添加数据集
              </button>
            </>
          </Card>
        </div>
        <div>
          <Card title="采样(Sample)">
            <div
              className={
                isVideoModel
                  ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'
              }
            >
              <div>
                <NumberInput
                  label="采样频率(Sample Every)"
                  value={jobConfig.config.process[0].sample.sample_every}
                  onChange={value => setJobConfig(value, 'config.process[0].sample.sample_every')}
                  placeholder="eg. 250"
                  min={1}
                  required
                />
                <SelectInput
                  label="采样器(Sampler)"
                  className="pt-2"
                  value={jobConfig.config.process[0].sample.sampler}
                  onChange={value => setJobConfig(value, 'config.process[0].sample.sampler')}
                  options={[
                    { value: 'flowmatch', label: 'FlowMatch' },
                    { value: 'ddpm', label: 'DDPM' },
                  ]}
                />
                <NumberInput
                  label="引导系数(Guidance Scale)"
                  value={jobConfig.config.process[0].sample.guidance_scale}
                  onChange={value => setJobConfig(value, 'config.process[0].sample.guidance_scale')}
                  placeholder="eg. 1.0"
                  className="pt-2"
                  min={0}
                  required
                />
                <NumberInput
                  label="采样步数(Sample Steps)"
                  value={jobConfig.config.process[0].sample.sample_steps}
                  onChange={value => setJobConfig(value, 'config.process[0].sample.sample_steps')}
                  placeholder="eg. 1"
                  className="pt-2"
                  min={1}
                  required
                />
              </div>
              <div>
                <NumberInput
                  label="宽度(Width)"
                  value={jobConfig.config.process[0].sample.width}
                  onChange={value => setJobConfig(value, 'config.process[0].sample.width')}
                  placeholder="eg. 1024"
                  min={0}
                  required
                />
                <NumberInput
                  label="高度(Height)"
                  value={jobConfig.config.process[0].sample.height}
                  onChange={value => setJobConfig(value, 'config.process[0].sample.height')}
                  placeholder="eg. 1024"
                  className="pt-2"
                  min={0}
                  required
                />
                {isVideoModel && (
                  <div>
                    <NumberInput
                      label="帧数(Num Frames)"
                      value={jobConfig.config.process[0].sample.num_frames}
                      onChange={value => setJobConfig(value, 'config.process[0].sample.num_frames')}
                      placeholder="eg. 0"
                      className="pt-2"
                      min={0}
                      required
                    />
                    <NumberInput
                      label="FPS"
                      value={jobConfig.config.process[0].sample.fps}
                      onChange={value => setJobConfig(value, 'config.process[0].sample.fps')}
                      placeholder="eg. 0"
                      className="pt-2"
                      min={0}
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <NumberInput
                  label="随机种子(Seed)"
                  value={jobConfig.config.process[0].sample.seed}
                  onChange={value => setJobConfig(value, 'config.process[0].sample.seed')}
                  placeholder="eg. 0"
                  min={0}
                  required
                />
                <Checkbox
                  label="稍动随机种子(Walk Seed)"
                  className="pt-4 pl-2"
                  checked={jobConfig.config.process[0].sample.walk_seed}
                  onChange={value => setJobConfig(value, 'config.process[0].sample.walk_seed')}
                />
              </div>
              <div>
                <FormGroup label="高级采样(Advanced Sampling)" className="pt-2">
                  <div>
                    <Checkbox
                      label="跳过首次采样(Skip First Sample)"
                      className="pt-4"
                      checked={jobConfig.config.process[0].train.skip_first_sample || false}
                      onChange={value => {
                        setJobConfig(value, 'config.process[0].train.skip_first_sample');
                        // cannot do both, so disable the other
                        if (value){
                          setJobConfig(false, 'config.process[0].train.force_first_sample');
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Checkbox
                      label="强制首次采样(Force First Sample)"
                      className="pt-1"
                      checked={jobConfig.config.process[0].train.force_first_sample || false}
                      docKey={'train.force_first_sample'}
                      onChange={value => {
                        setJobConfig(value, 'config.process[0].train.force_first_sample');
                        // cannot do both, so disable the other
                        if (value){
                          setJobConfig(false, 'config.process[0].train.skip_first_sample');
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Checkbox
                      label="禁用采样(Disable Sampling)"
                      className="pt-1"
                      checked={jobConfig.config.process[0].train.disable_sampling || false}
                      onChange={value => {
                        setJobConfig(value, 'config.process[0].train.disable_sampling');
                        // cannot do both, so disable the other
                        if (value){
                          setJobConfig(false, 'config.process[0].train.force_first_sample');
                        }
                      }}
                    />
                  </div>
                </FormGroup>
              </div>
            </div>
            <FormGroup label={`采样提示词 (${jobConfig.config.process[0].sample.samples.length})`} className="pt-2">
              <div></div>
            </FormGroup>
            {jobConfig.config.process[0].sample.samples.map((sample, i) => (
              <div key={i} className="rounded-lg pl-4 pr-1 mb-4 bg-gray-950">
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <div className="flex">
                      <div className="flex-1">
                        <TextInput
                          label={`提示词(Prompt)`}
                          value={sample.prompt}
                          onChange={value => setJobConfig(value, `config.process[0].sample.samples[${i}].prompt`)}
                          placeholder="woman with red hair, playing chess at the park"
                          required
                        />
                      </div>

                      {modelArch?.additionalSections?.includes('sample.ctrl_img') && (
                        <div
                          className="h-14 w-14 mt-2 ml-4 border border-gray-500 flex items-center justify-center rounded cursor-pointer hover:bg-gray-700 transition-colors"
                          style={{
                            backgroundImage: sample.ctrl_img
                              ? `url(${`/api/img/${encodeURIComponent(sample.ctrl_img)}`})`
                              : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            marginBottom: '-1rem',
                          }}
                          onClick={() => {
                            openAddImageModal(imagePath => {
                              console.log('Selected image path:', imagePath);
                              if (!imagePath) return;
                              setJobConfig(imagePath, `config.process[0].sample.samples[${i}].ctrl_img`);
                            });
                          }}
                        >
                          {!sample.ctrl_img && (
                            <div className="text-gray-400 text-xs text-center font-bold">添加控制图像</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="pb-4"></div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setJobConfig(
                          jobConfig.config.process[0].sample.samples.filter((_, index) => index !== i),
                          'config.process[0].sample.samples',
                        )
                      }
                      className="rounded-full p-1 text-sm"
                    >
                      <X />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setJobConfig(
                  [...jobConfig.config.process[0].sample.samples, { prompt: '' }],
                  'config.process[0].sample.samples',
                )
              }
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              添加提示词
            </button>
          </Card>
        </div>

        {status === 'success' && <p className="text-green-500 text-center">训练保存成功！</p>}
        {status === 'error' && <p className="text-red-500 text-center">保存训练时出错，请重试。</p>}
      </form>
      <AddSingleImageModal />
    </>
  );
}
