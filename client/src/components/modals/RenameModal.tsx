import {
  useEffect,
  useState,
} from "react";

import Modal from "./Modal";

interface RenameModalProps {
  open: boolean;
  onClose: () => void;
  currentName: string;
  onSubmit: (name: string) => void;
  loading?: boolean;
}

const RenameModal = ({
  open,
  onClose,
  currentName,
  onSubmit,
  loading = false,
}: RenameModalProps) => {
  const [name, setName] = useState(
    currentName,
  );

  useEffect(() => {
    if (open) {
      setName(currentName);
    }
  }, [open, currentName]);

  const handleSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const trimmedName =
      name.trim();

    if (!trimmedName) {
      return;
    }

    onSubmit(trimmedName);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rename"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="rename-item"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Name
          </label>

          <input
            id="rename-item"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            autoFocus
            className="
              h-11 w-full rounded-lg
              border border-slate-300
              bg-white px-3
              text-sm text-slate-900
              outline-none
              focus:border-blue-500
              focus:ring-4
              focus:ring-blue-100
            "
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              loading ||
              !name.trim()
            }
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RenameModal;