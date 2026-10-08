import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconBgColor?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-[#12355b]',
  action
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-200/80 dark:border-gray-800">
      <div className="flex items-start sm:items-center gap-3.5">
        {Icon && (
          <div className={`${iconBgColor} text-white p-3 rounded-2xl shadow-md shrink-0 flex items-center justify-center`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#172033] dark:text-white tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
};
