import Link from 'next/link';
import { Home, Settings, BrainCircuit, Images, Plus} from 'lucide-react';

const Sidebar = () => {
  const navigation = [
    { name: '概况', href: '/dashboard', icon: Home },
    { name: '创建任务', href: '/jobs/new', icon: Plus },
    { name: '训练任务', href: '/jobs', icon: BrainCircuit },
    { name: '数据集', href: '/datasets', icon: Images },
    { name: '设置', href: '/settings', icon: Settings },
  ];


  return (
    <div className="flex flex-col w-59 bg-gray-900 text-gray-100">
      <div className="px-4 py-3">
        <h1 className="text-l">
          <img src="/ostris_logo.png" alt="灵台AI大模型" className="w-auto h-7 mr-3 inline" />
          <span className="font-bold uppercase">灵台</span>
          <span className="ml-2 uppercase text-gray-300">AI大模型</span>
        </h1>
      </div>
      <nav className="flex-1">
        <ul className="px-2 py-4 space-y-2">
          {navigation.map(item => (
            <li key={item.name}>
              <Link
                href={item.href}
                className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
