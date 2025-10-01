import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type ThemeContextType = {
  darkMode: boolean;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Check if user has previously set a preference
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      // Check for saved theme or system preference
      return savedTheme === 'dark' || 
        (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Helper function to update theme-color meta tag
  const updateThemeColor = (color: string) => {
    // Remove all existing theme-color meta tags
    const existingMetas = document.querySelectorAll('meta[name="theme-color"]');
    console.log(`[Theme] Removing ${existingMetas.length} existing theme-color meta tags`);
    existingMetas.forEach(meta => meta.remove());
    
    // Create a single new theme-color meta tag without media query
    const metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    metaThemeColor.setAttribute('content', color);
    document.head.appendChild(metaThemeColor);
    console.log(`[Theme] Set theme-color to: ${color}`);
  };

  useEffect(() => {
    // Update class on document element
    if (darkMode) {
      document.documentElement.classList.add('dark');
      // Set color-scheme CSS property for iOS Safari
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
      // Update theme-color meta tag for iOS status bar (matches header bg-gray-800)
      updateThemeColor('#1f2937');
    } else {
      document.documentElement.classList.remove('dark');
      // Set color-scheme CSS property for iOS Safari
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
      // Update theme-color meta tag for iOS status bar
      updateThemeColor('#ffffff');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
