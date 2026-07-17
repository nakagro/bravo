import React, { useState, useCallback, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Save,
  QrCode,
  Link2,
  Tag,
  Copy,
  Printer,
  Share2,
  ChevronDown,
  Palette,
} from 'lucide-react';
import { toast } from 'sonner';

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

interface QRCodeGeneratorProps {
  onSaved?: () => void;
}

function svgToPngBlob(svgData: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const scale = 4;
      const canvas = document.createElement('canvas');
      canvas.width = 256 * scale;
      canvas.height = 256 * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { URL.revokeObjectURL(svgUrl); resolve(blob); }, 'image/png');
      } else {
        URL.revokeObjectURL(svgUrl);
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(null); };
    img.src = svgUrl;
  });
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isValidUrl(value: string): boolean {
  try { new URL(value.trim()); return true; } catch { return false; }
}

export function QRCodeGenerator({ onSaved }: QRCodeGeneratorProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#000000');
  const [errorLevel, setErrorLevel] = useState<ErrorCorrectionLevel>('M');
  const [svgData, setSvgData] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createQRCode = useMutation(api.qrCodes.createQRCode);
  const urlValid = url.trim() !== '' && isValidUrl(url);

  // Auto-generate on any input change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!url.trim() || !isValidUrl(url)) { setSvgData(null); return; }
      try {
        const svg = await QRCode.toString(url.trim(), {
          type: 'svg',
          width: 256,
          margin: 2,
          errorCorrectionLevel: errorLevel,
          color: { dark: color, light: '#ffffff' },
        });
        setSvgData(svg);
      } catch {
        setSvgData(null);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url, color, errorLevel]);

  const getPngBlob = useCallback(() => svgToPngBlob(svgData ?? ''), [svgData]);

  const handleSave = useCallback(async () => {
    if (!svgData) return;
    setIsSaving(true);
    try {
      await createQRCode({ name: name.trim() || undefined, url: url.trim(), svgData });
      toast.success('QR code saved to library');
      setUrl(''); setName(''); setSvgData(null);
      onSaved?.();
    } catch {
      toast.error('Failed to save QR code');
    } finally {
      setIsSaving(false);
    }
  }, [svgData, name, url, createQRCode, onSaved]);

  const handleDownload = useCallback(async (format: 'svg' | 'png') => {
    if (!svgData) return;
    const fileName = name.trim() || 'qr-code';
    if (format === 'svg') {
      triggerDownload(new Blob([svgData], { type: 'image/svg+xml' }), `${fileName}.svg`);
      toast.success('SVG downloaded');
    } else {
      const blob = await svgToPngBlob(svgData);
      if (blob) { triggerDownload(blob, `${fileName}.png`); toast.success('PNG downloaded (1024×1024)'); }
    }
  }, [svgData, name]);

  const handleCopyImage = useCallback(async () => {
    if (!svgData) return;
    const blob = await svgToPngBlob(svgData);
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('QR code copied to clipboard');
    } catch {
      toast.error('Clipboard access not supported in this browser');
    }
  }, [svgData]);

  const handlePrint = useCallback(() => {
    if (!svgData) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${name || 'QR Code'}</title><style>
      body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;}
      .qr{width:300px;height:300px;}.name{font-size:18px;font-weight:600;margin:16px 0 4px;}.url{font-size:12px;color:#666;max-width:300px;word-break:break-all;text-align:center;}
    </style></head><body><div class="qr">${svgData}</div>${name ? `<div class="name">${name}</div>` : ''}<div class="url">${url}</div>
    <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
    w.document.close();
  }, [svgData, name, url]);

  const handleShare = useCallback(async () => {
    if (!navigator.share || !svgData) return;
    try {
      const blob = await svgToPngBlob(svgData);
      if (blob) {
        const file = new File([blob], `${name || 'qr-code'}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: name || 'QR Code', text: url, files: [file] });
          return;
        }
      }
      await navigator.share({ title: name || 'QR Code', url });
    } catch { /* user cancelled */ }
  }, [svgData, name, url]);

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      {/* Left: Form */}
      <div className="space-y-5">
        {/* URL — required */}
        <div className="space-y-1.5">
          <Label htmlFor="url" className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="w-4 h-4" />
            URL
            <span className="text-destructive text-xs">required</span>
          </Label>
          <div className="relative">
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={url && !urlValid ? 'border-destructive focus-visible:ring-destructive pr-8' : 'pr-8'}
            />
            {url && (
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-colors ${urlValid ? 'bg-green-500' : 'bg-destructive'}`}
              />
            )}
          </div>
          {url && !urlValid && (
            <p className="text-xs text-destructive">Enter a valid URL (e.g., https://example.com)</p>
          )}
        </div>

        {/* Name — optional */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
            <Tag className="w-4 h-4" />
            Name
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="My QR Code"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Palette className="w-4 h-4" />
              Color
            </Label>
            <div className="flex items-center gap-2.5 h-10 px-3 rounded-md border border-input bg-background cursor-pointer">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
              />
              <span className="text-sm font-mono text-muted-foreground">{color.toUpperCase()}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Error Correction</Label>
            <Select value={errorLevel} onValueChange={(v) => setErrorLevel(v as ErrorCorrectionLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="L">Low (7%)</SelectItem>
                <SelectItem value="M">Medium (15%)</SelectItem>
                <SelectItem value="Q">Quartile (25%)</SelectItem>
                <SelectItem value="H">High (30%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action buttons — appear once QR is ready */}
        {svgData && (
          <div className="flex flex-wrap gap-2 pt-1 border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleCopyImage}>
              <Copy className="w-4 h-4 mr-1.5" />
              Copy Image
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1.5" />
                  Download
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleDownload('png')}>
                  PNG (1024×1024)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('svg')}>
                  SVG (vector)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" />
              Print
            </Button>

            {canShare && (
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-1.5" />
                Share
              </Button>
            )}

            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  Save to Library
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Right: Live preview */}
      <div className="flex flex-col items-center gap-3">
        {svgData ? (
          <>
            <div className="flex items-center justify-center p-6 bg-white rounded-2xl border shadow-sm w-full max-w-xs aspect-square">
              <div
                className="w-full h-full [&_svg]:w-full [&_svg]:h-full"
                dangerouslySetInnerHTML={{ __html: svgData }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground max-w-xs break-all px-2">{url}</p>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center w-full max-w-xs aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/20 gap-4">
            <QrCode className="w-16 h-16 text-muted-foreground/20" />
            <p className="text-sm text-center text-muted-foreground px-8 leading-relaxed">
              {url && !urlValid
                ? 'Enter a valid URL to preview'
                : 'Enter a URL above for a live preview'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
