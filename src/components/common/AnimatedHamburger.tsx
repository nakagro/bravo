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
          block absolute h-[4px] w-full rounded-[4px] left-0
          transition-all duration-250 ease-in-out
          ${isOpen ? 'top-[13px] rotate-[135deg] bg-foreground opacity-100' : 'top-[4px] rotate-0 bg-foreground opacity-100'}
        `}
      />
      <span 
        className={`
          block absolute h-[4px] w-full rounded-[4px] left-0
          transition-all duration-250 ease-in-out
          bg-foreground
          top-[13px]
          ${isOpen ? 'opacity-0 -left-[60px]' : 'opacity-100 left-0'}
        `}
      />
      <span 
        className={`
          block absolute h-[4px] w-full rounded-[4px] left-0
          transition-all duration-250 ease-in-out
          ${isOpen ? 'top-[13px] rotate-[-135deg] bg-foreground opacity-100' : 'top-[22px] rotate-0 bg-foreground opacity-100'}
        `}
      />
    </div>
  );
}
