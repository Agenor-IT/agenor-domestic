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
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200/80 dark:border-gray-800">
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div className={`${iconBgColor} text-white p-2.5 sm:p-3 rounded-2xl shadow-md shrink-0 flex items-center justify-center`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#172033] dark:text-white tracking-tight break-words">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5 line-clamp-2 sm:line-clamp-none">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="w-full lg:w-auto shrink-0 flex flex-wrap items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
};
