import {
  useEffect,
  useState,
} from "react";

import Modal from "./Modal";

interface CreateDirectoryModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  loading?: boolean;
}

const CreateDirectoryModal = ({
  open,
  onClose,
  onSubmit,
  loading = false,
}: CreateDirectoryModalProps) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
    }
  }, [open]);

  const handleSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    onSubmit(name.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create folder"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="folder-name"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Folder name
          </label>

          <input
            id="folder-name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            autoFocus
            placeholder="New folder"
            className="
              h-11 w-full rounded-lg
              border border-slate-300
              bg-white px-3
              text-sm text-slate-900
              outline-none
              placeholder:text-slate-400
              focus:border-blue-500
              focus:ring-4
              focus:ring-blue-100
            "
          />

          <p className="mt-2 text-xs text-slate-400">
            Leave empty to create a default folder name.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="
              rounded-lg border border-slate-200
              bg-white px-4 py-2.5
              text-sm font-medium text-slate-700
              hover:bg-slate-50
              disabled:opacity-50
            "
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="
              rounded-lg bg-blue-600
              px-4 py-2.5
              text-sm font-medium text-white
              hover:bg-blue-700
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateDirectoryModal;