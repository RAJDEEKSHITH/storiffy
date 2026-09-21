import {
  Download,
  Ellipsis,
  FilePenLine,
  Info,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface DriveItemActionsProps {
  onDetails: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
  downloadDisabled?: boolean;
}

const DriveItemActions = ({
  onDetails,
  onDownload,
  onShare,
  onRename,
  onDelete,
  downloadDisabled = false,
}: DriveItemActionsProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
            aria-label="More options"
          />
        }
      >
        <Ellipsis className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-48"
      >
        <DropdownMenuItem onClick={onDetails}>
          <Info className="size-4" />
          Details
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={downloadDisabled}
          onClick={onDownload}
        >
          <Download className="size-4" />
          Download
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onShare}>
          <Share2 className="size-4 text-blue-600" />
          Share link
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onRename}>
          <FilePenLine className="size-4" />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700"
        >
          <Trash2 className="size-4 text-red-600" />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DriveItemActions;
