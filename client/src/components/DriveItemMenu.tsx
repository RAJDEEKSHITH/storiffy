import {
  Download,
  EllipsisVertical,
  FilePenLine,
  Info,
  Share2,
  Trash2,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

interface DriveItemMenuProps {
  onDetails: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

const MENU_WIDTH = 192;
const MENU_HEIGHT = 260;
const GAP = 6;

const DriveItemMenu = ({
  onDetails,
  onDownload,
  onShare,
  onRename,
  onDelete,
}: DriveItemMenuProps) => {
  const buttonRef =
    useRef<HTMLButtonElement>(null);

  const [open, setOpen] =
    useState(false);

  const [position, setPosition] =
    useState<MenuPosition>({
      top: 0,
      left: 0,
    });

  const updatePosition = () => {
    if (!buttonRef.current) {
      return;
    }

    const rect =
      buttonRef.current.getBoundingClientRect();

    const viewportWidth =
      window.innerWidth;

    const viewportHeight =
      window.innerHeight;

    let left =
      rect.right - MENU_WIDTH;

    let top =
      rect.bottom + GAP;

    // Prevent right overflow.
    if (left < 8) {
      left = 8;
    }

    if (
      left + MENU_WIDTH >
      viewportWidth - 8
    ) {
      left =
        viewportWidth -
        MENU_WIDTH -
        8;
    }

    // If there isn't enough room below,
    // open upward.
    if (
      top + MENU_HEIGHT >
      viewportHeight - 8
    ) {
      top =
        rect.top -
        MENU_HEIGHT -
        GAP;
    }

    // Prevent top overflow.
    if (top < 8) {
      top = 8;
    }

    setPosition({
      top,
      left,
    });
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    const handleWindowChange = () => {
      updatePosition();
    };

    window.addEventListener(
      "resize",
      handleWindowChange,
    );

    window.addEventListener(
      "scroll",
      handleWindowChange,
      true,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleWindowChange,
      );

      window.removeEventListener(
        "scroll",
        handleWindowChange,
        true,
      );
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      const target =
        event.target as HTMLElement;

      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        !target.closest(
          "[data-drive-item-menu]",
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, [open]);

  const action = (
    callback: () => void,
  ) => {
    setOpen(false);
    callback();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();

          setOpen(
            (current) => !current,
          );
        }}
        className={`
          rounded-lg p-1.5
          text-slate-400
          transition
          hover:bg-slate-100
          hover:text-slate-700
          ${open ? "bg-slate-100 text-slate-700" : ""}
        `}
        aria-label="More options"
        aria-expanded={open}
      >
        <EllipsisVertical size={18} />
      </button>

      {open && (
        <div
          data-drive-item-menu
          className="
            fixed z-[80]
            w-48
            overflow-hidden
            rounded-xl
            border border-slate-200
            bg-white
            py-1
            shadow-2xl
          "
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <button
            type="button"
            onClick={() =>
              action(onDetails)
            }
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Info size={17} />
            Details
          </button>

          <button
            type="button"
            onClick={() =>
              action(onDownload)
            }
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Download size={17} />
            Download
          </button>

          <button
            type="button"
            onClick={() =>
              action(onShare)
            }
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Share2 size={17} />
            Share
          </button>

          <button
            type="button"
            onClick={() =>
              action(onRename)
            }
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FilePenLine size={17} />
            Rename
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() =>
              action(onDelete)
            }
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={17} />
            Move to trash
          </button>
        </div>
      )}
    </>
  );
};

export default DriveItemMenu;