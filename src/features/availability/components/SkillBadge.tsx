import React from 'react';

interface SkillBadgeProps {
  code: string;
  name: string;
}

const SkillBadge: React.FC<SkillBadgeProps> = ({ code, name }) => {
  return (
    <div 
      className="inline-flex items-center justify-center h-5 w-auto min-w-[2rem] px-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 mr-1 mb-1 border border-gray-300 dark:border-gray-600"
      title={name}
    >
      {code}
    </div>
  );
};

export default SkillBadge;
