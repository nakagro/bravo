import React, { useState, useCallback, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  Trash2,
  ExternalLink,
  QrCode,
  Copy,
  Edit2,
  Printer,
  Share2,
  ChevronDown,
  Search,
  X,
  Check,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type QRCodeEntry = {
  _id: Id<'qrCodes'>;
  name?: string;
  url: string;
  svgData: string;
  createdAt: number;
};

// ── Shared helpers ───────────────────────────────────────────────────────────

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

function printQR(svgData: string, name?: string, url?: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${name || 'QR Code'}</title><style>
    body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;}
    .qr{width:300px;height:300px;}.name{font-size:18px;font-weight:600;margin:16px 0 4px;}.url{font-size:12px;color:#666;max-width:300px;word-break:break-all;text-align:center;}
  </style></head><body><div class="qr">${svgData}</div>
  ${name ? `<div class="name">${name}</div>` : ''}
  ${url ? `<div class="url">${url}</div>` : ''}
  <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
  w.document.close();
}

async function copyImageToClipboard(svgData: string) {
  const blob = await svgToPngBlob(svgData);
  if (!blob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast.success('QR code copied to clipboard');
  } catch {
    toast.error('Clipboard access not supported in this browser');
  }
}

async function shareQR(svgData: string, name?: string, url?: string) {
  if (!navigator.share) return;
  try {
    const blob = await svgToPngBlob(svgData);
    if (blob) {
      const file = new File([blob], `${name || 'qr-code'}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: name || 'QR Code', text: url, files: [file] });
        return;
      }
    }
    if (url) await navigator.share({ title: name || 'QR Code', url });
  } catch { /* user cancelled */ }
}

// ── Detail dialog ─────────────────────────────────────────────────────────────

interface QRDetailDialogProps {
  qrCode: QRCodeEntry | null;
  onClose: () => void;
  onDelete: (id: Id<'qrCodes'>) => void;
  onEdit: (qrCode: QRCodeEntry) => void;
}

function QRDetailDialog({ qrCode, onClose, onDelete, onEdit }: QRDetailDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleDownload = async (format: 'svg' | 'png') => {
    if (!qrCode) return;
    const fileName = qrCode.name || 'qr-code';
    if (format === 'svg') {
      triggerDownload(new Blob([qrCode.svgData], { type: 'image/svg+xml' }), `${fileName}.svg`);
      toast.success('SVG downloaded');
    } else {
      const blob = await svgToPngBlob(qrCode.svgData);
      if (blob) { triggerDownload(blob, `${fileName}.png`); toast.success('PNG downloaded'); }
    }
  };

  return (
    <>
      <Dialog open={!!qrCode && !showDeleteConfirm} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrCode?.name ?? 'QR Code'}</DialogTitle>
          </DialogHeader>
          {qrCode && (
            <div className="space-y-4">
              {/* Large QR preview */}
              <div className="flex items-center justify-center p-6 bg-white rounded-xl border">
                <div
                  className="w-56 h-56 [&_svg]:w-full [&_svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrCode.svgData }}
                />
              </div>

              {/* URL link */}
              <a
                href={qrCode.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="break-all min-w-0">{qrCode.url}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              </a>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => copyImageToClipboard(qrCode.svgData)}>
                  <Copy className="w-4 h-4 mr-1.5" />Copy Image
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-1.5" />Download
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleDownload('png')}>PNG (1024×1024)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload('svg')}>SVG (vector)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => printQR(qrCode.svgData, qrCode.name, qrCode.url)}>
                  <Printer className="w-4 h-4 mr-1.5" />Print
                </Button>
                {canShare && (
                  <Button variant="outline" size="sm" onClick={() => shareQR(qrCode.svgData, qrCode.name, qrCode.url)}>
                    <Share2 className="w-4 h-4 mr-1.5" />Share
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(qrCode)}
                >
                  <Edit2 className="w-4 h-4 mr-1.5" />Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {qrCode && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete QR Code</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{qrCode.name ?? 'Unnamed'}&quot;? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => {
                  onDelete(qrCode._id);
                  setShowDeleteConfirm(false);
                  onClose();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

interface QREditDialogProps {
  qrCode: QRCodeEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

function QREditDialog({ qrCode, onClose, onSaved }: QREditDialogProps) {
  const [editUrl, setEditUrl] = useState('');
  const [editName, setEditName] = useState('');
  const [editSvg, setEditSvg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateQRCode = useMutation(api.qrCodes.updateQRCode);

  useEffect(() => {
    if (qrCode) {
      setEditUrl(qrCode.url);
      setEditName(qrCode.name ?? '');
      setEditSvg(qrCode.svgData);
    }
  }, [qrCode]);

  const editUrlValid = editUrl.trim() !== '' && (() => {
    try { new URL(editUrl.trim()); return true; } catch { return false; }
  })();

  // Live preview while editing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!editUrl.trim() || !editUrlValid) { setEditSvg(null); return; }
      try {
        const svg = await QRCode.toString(editUrl.trim(), {
          type: 'svg', width: 256, margin: 2, errorCorrectionLevel: 'M',
        });
        setEditSvg(svg);
      } catch { setEditSvg(null); }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [editUrl, editUrlValid]);

  const handleSave = async () => {
    if (!qrCode || !editSvg || !editUrlValid) return;
    setIsSaving(true);
    try {
      await updateQRCode({
        id: qrCode._id,
        name: editName.trim() || undefined,
        url: editUrl.trim(),
        svgData: editSvg,
      });
      toast.success('QR code updated');
      onSaved();
    } catch {
      toast.error('Failed to update QR code');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!qrCode} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit QR Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-url">URL</Label>
            <div className="relative">
              <Input
                id="edit-url"
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                className={editUrl && !editUrlValid ? 'border-destructive pr-8' : 'pr-8'}
              />
              {editUrl && (
                <div
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${editUrlValid ? 'bg-green-500' : 'bg-destructive'}`}
                />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">
              Name{' '}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="My QR Code"
            />
          </div>

          {/* Live preview while editing */}
          {editSvg ? (
            <div className="flex justify-center p-4 bg-white rounded-xl border">
              <div
                className="w-40 h-40 [&_svg]:w-full [&_svg]:h-full"
                dangerouslySetInnerHTML={{ __html: editSvg }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 rounded-xl border-2 border-dashed border-muted-foreground/20">
              <QrCode className="w-10 h-10 text-muted-foreground/20" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={isSaving || !editSvg || !editUrlValid}
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── QR Code grid card ─────────────────────────────────────────────────────────

interface QRCardProps {
  qrCode: QRCodeEntry;
  onView: () => void;
  onEdit: () => void;
  onDelete: (id: Id<'qrCodes'>) => void;
}

function QRCard({ qrCode, onView, onEdit, onDelete }: QRCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleDownload = async (format: 'svg' | 'png') => {
    const fileName = qrCode.name || 'qr-code';
    if (format === 'svg') {
      triggerDownload(new Blob([qrCode.svgData], { type: 'image/svg+xml' }), `${fileName}.svg`);
      toast.success('SVG downloaded');
    } else {
      const blob = await svgToPngBlob(qrCode.svgData);
      if (blob) { triggerDownload(blob, `${fileName}.png`); toast.success('PNG downloaded'); }
    }
  };

  return (
    <>
      <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all duration-200">
        {/* QR Image - tap to zoom/view */}
        <button
          className="w-full bg-white flex items-center justify-center p-5 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={onView}
          title="Click to view"
        >
          <div
            className="w-full aspect-square max-w-[160px] [&_svg]:w-full [&_svg]:h-full"
            dangerouslySetInnerHTML={{ __html: qrCode.svgData }}
          />
        </button>

        {/* Info */}
        <div className="px-4 pt-3 pb-1">
          <h3 className="font-semibold text-sm truncate">{qrCode.name ?? 'Unnamed'}</h3>
          <a
            href={qrCode.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary truncate block mt-0.5"
          >
            {qrCode.url}
          </a>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {formatDistanceToNow(qrCode.createdAt, { addSuffix: true })}
          </p>
        </div>

        {/* Actions */}
        <div className="px-3 pb-3 pt-2 flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => {
              navigator.clipboard.writeText(qrCode.url).then(() => toast.success('URL copied'));
            }}
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy URL
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="More options">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => copyImageToClipboard(qrCode.svgData)}>
                <Copy className="w-4 h-4 mr-2" />Copy Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload('png')}>
                <Download className="w-4 h-4 mr-2" />Download PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload('svg')}>
                <Download className="w-4 h-4 mr-2" />Download SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => printQR(qrCode.svgData, qrCode.name, qrCode.url)}>
                <Printer className="w-4 h-4 mr-2" />Print
              </DropdownMenuItem>
              {canShare && (
                <DropdownMenuItem onClick={() => shareQR(qrCode.svgData, qrCode.name, qrCode.url)}>
                  <Share2 className="w-4 h-4 mr-2" />Share
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-2" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete QR Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{qrCode.name ?? 'Unnamed'}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { onDelete(qrCode._id); setConfirmDelete(false); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function QRCodeList() {
  const qrCodes = useQuery(api.qrCodes.getUserQRCodes);
  const deleteQRCode = useMutation(api.qrCodes.deleteQRCode);
  const [search, setSearch] = useState('');
  const [viewingQR, setViewingQR] = useState<QRCodeEntry | null>(null);
  const [editingQR, setEditingQR] = useState<QRCodeEntry | null>(null);

  const handleDelete = useCallback(async (id: Id<'qrCodes'>) => {
    try {
      await deleteQRCode({ id });
      toast.success('QR code deleted');
    } catch {
      toast.error('Failed to delete QR code');
    }
  }, [deleteQRCode]);

  if (qrCodes === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <span>Loading...</span>
      </div>
    );
  }

  if (qrCodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="rounded-full bg-muted p-6">
          <QrCode className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">No saved QR codes yet</h3>
          <p className="text-sm text-muted-foreground">
            Switch to the Generate tab to create your first QR code.
          </p>
        </div>
      </div>
    );
  }

  const filtered = search.trim()
    ? qrCodes.filter((qr) =>
        (qr.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        qr.url.toLowerCase().includes(search.toLowerCase())
      )
    : qrCodes;

  return (
    <>
      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name or URL…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <Search className="w-8 h-8 opacity-30" />
          <p className="text-sm">No results for &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((qrCode) => (
            <QRCard
              key={qrCode._id}
              qrCode={qrCode}
              onView={() => setViewingQR(qrCode)}
              onEdit={() => { setViewingQR(null); setEditingQR(qrCode); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <QRDetailDialog
        qrCode={viewingQR}
        onClose={() => setViewingQR(null)}
        onDelete={handleDelete}
        onEdit={(qr) => { setViewingQR(null); setEditingQR(qr); }}
      />

      <QREditDialog
        qrCode={editingQR}
        onClose={() => setEditingQR(null)}
        onSaved={() => setEditingQR(null)}
      />
    </>
  );
}
