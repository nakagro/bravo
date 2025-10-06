interface AnimatedHamburgerProps {
  isOpen: boolean;
}

export function AnimatedHamburger({ isOpen }: AnimatedHamburgerProps) {
  return (
    <div 
      className={`relative w-[40px] h-[30px] transition-transform duration-500 ease-in-out ${isOpen ? 'open' : ''}`}
      aria-hidden="true"
    >
      <span 
        className={`
          block absolute h-[6px] w-full rounded-[6px] opacity-100 left-0
          transition-all duration-250 ease-in-out
          bg-foreground
          ${isOpen ? 'top-[12px] rotate-[135deg]' : 'top-0 rotate-0'}
        `}
      />
      <span 
        className={`
          block absolute h-[6px] w-full rounded-[6px] left-0
          transition-all duration-250 ease-in-out
          bg-foreground
          top-[12px]
          ${isOpen ? 'opacity-0 -left-[60px]' : 'opacity-100 left-0'}
        `}
      />
      <span 
        className={`
          block absolute h-[6px] w-full rounded-[6px] opacity-100 left-0
          transition-all duration-250 ease-in-out
          bg-foreground
          ${isOpen ? 'top-[12px] rotate-[-135deg]' : 'top-[24px] rotate-0'}
        `}
      />
    </div>
  );
}
