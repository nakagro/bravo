import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ShieldAlert } from 'lucide-react';

const EASTER_EGGS = [
  "Maybe try being a Captain? They have all the good stuff.",
  "Have you tried turning your rank off and on again?",
  "This area is above your pay grade. Literally.",
  "The turnout gear for this module is admin-only.",
  "Plot twist: the real access was the friends we made along the way.",
  "ERROR 403: Insufficient bravery detected.",
  "You shall not pass. (This is not a drill.)",
  "Access denied. Have you considered becoming a Lieutenant?",
  "This door requires a key. You do not have the key.",
];

interface AccessDeniedProps {
  moduleId?: string;
}

export function AccessDenied({ moduleId }: AccessDeniedProps) {
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [eggIndex] = useState(() => Math.floor(Math.random() * EASTER_EGGS.length));

  const handleIconClick = () => {
    setClickCount(c => c + 1);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div
        className="cursor-pointer select-none mb-6 transition-transform active:scale-95"
        onClick={handleIconClick}
        title="..."
      >
        <ShieldAlert
          className={`w-20 h-20 mx-auto transition-colors duration-300 ${
            clickCount >= 5
              ? 'text-orange-500 dark:text-orange-400'
              : 'text-muted-foreground'
          }`}
        />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
        Access Denied
      </h1>

      <p className="text-muted-foreground text-base mb-1">
        Oops — looks like you don't have permission to view this
        {moduleId ? ` (${moduleId})` : ' area'}.
      </p>

      <p className="text-muted-foreground text-sm mb-8">
        If you think this is a mistake, contact your brigade admin.
      </p>

      {clickCount >= 3 && (
        <p className="text-xs text-muted-foreground italic mb-6 max-w-xs animate-in fade-in duration-500">
          {EASTER_EGGS[eggIndex]}
        </p>
      )}

      <Button variant="outline" onClick={() => navigate('/')}>
        Take me home
      </Button>
    </div>
  );
}
