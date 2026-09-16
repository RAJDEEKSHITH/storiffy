import { Copy, Share2 } from "lucide-react";

import Modal from "./Modal";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  onCopy?: () => void;
}

const ShareModal = ({
  open,
  onClose,
  itemName,
  onCopy,
}: ShareModalProps) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share"
      maxWidth="max-w-lg"
    >
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Share2 size={19} />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {itemName}
            </p>

            <p className="text-xs text-slate-500">
              Create a shareable link
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <input
            readOnly
            value="Share link will be generated here"
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
          />

          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Copy size={16} />
            Copy
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ShareModal;