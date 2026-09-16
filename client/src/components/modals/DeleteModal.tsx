import { Trash2 } from "lucide-react";

import Modal from "./Modal";

interface DeleteModalProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  itemType: "file" | "directory";
  onConfirm: () => void;
  loading?: boolean;
}

const DeleteModal = ({
  open,
  onClose,
  itemName,
  itemType,
  onConfirm,
  loading = false,
}: DeleteModalProps) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move to trash"
    >
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Trash2 size={22} />
        </div>

        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Move this{" "}
          {itemType} to trash?
        </h3>

        <p className="mx-auto mt-2 max-w-sm break-words text-sm text-slate-500">
          <span className="font-medium text-slate-700">
            {itemName}
          </span>{" "}
          will be moved to Trash.
        </p>

        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Moving..."
              : "Move to trash"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteModal;