import React from 'react';

interface SkillBadgeProps {
  code: string;
  name: string;
  size?: 'sm' | 'md';
}

function SkillBadge({ code, name, size = 'md' }: SkillBadgeProps) {
  const sizeClasses =
    size === 'sm'
      ? 'h-4 min-w-[1.5rem] px-1 text-[10px] mr-1 mb-1'
      : 'h-5 min-w-[2rem] px-1 text-xs mr-1 mb-1';

  return (
    <div
      className={`inline-flex items-center justify-center w-auto rounded-full font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 ${sizeClasses}`}
      title={name}
    >
      {code}
    </div>
  );
}

export default SkillBadge;
