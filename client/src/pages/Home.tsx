import { Plus, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import { useSelector } from "react-redux";

import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import DirectoryItemsView from "../components/DirectoryItemsView";

import CreateDirectoryModal from "../components/modals/CreateDirectoryModal";
import RenameModal from "../components/modals/RenameModal";
import DeleteModal from "../components/modals/DeleteModal";

import {
  createFolder,
  deleteDirectory,
  getDirectoryItems,
  renameDirectory,
} from "../api/directoryApi";

import type {
  Directory,
  DirectoryResponse,
} from "../types/directory";

import type { RootState } from "../store/store";

const Home = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const user = useSelector(
    (state: RootState) => state.auth.user,
  );

  const [directoryData, setDirectoryData] =
    useState<DirectoryResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [createFolderOpen, setCreateFolderOpen] =
    useState(false);

  const [folderToRename, setFolderToRename] =
    useState<Directory | null>(null);

  const [folderToDelete, setFolderToDelete] =
    useState<Directory | null>(null);

  const [actionLoading, setActionLoading] =
    useState(false);

  // -----------------------------------
  // Get current directory from backend
  // -----------------------------------
  useEffect(() => {
    const loadDirectory = async () => {
      setLoading(true);

      try {
        const data = await getDirectoryItems(id);

        setDirectoryData(data);
      } catch (error) {
        console.error(
          "Failed to load directory:",
          error,
        );

        setDirectoryData(null);
      } finally {
        setLoading(false);
      }
    };

    loadDirectory();
  }, [id]);

  if (!user) {
    return null;
  }

  const isRoot = !id;

  const directories =
    directoryData?.directories ?? [];

  const files =
    directoryData?.files ?? [];

  const totalItems =
    directories.length + files.length;

  // -----------------------------------
  // Open folder
  // -----------------------------------
  const handleOpenDirectory = (
    directoryId: string,
  ) => {
    navigate(`/${directoryId}`);
  };

  // -----------------------------------
  // Go to root
  // -----------------------------------
  const handleHome = () => {
    navigate("/");
  };

  // -----------------------------------
  // Create folder
  // -----------------------------------
  const handleCreateFolder = async (
    name: string,
  ) => {
    if (!directoryData) {
      return;
    }

    setActionLoading(true);

    try {
      await createFolder({
        parentDirectoryId:
          directoryData.directory._id,
        name,
      });

      setCreateFolderOpen(false);

      // Get the latest data again
      // so the new folder appears.
      const data = await getDirectoryItems(id);

      setDirectoryData(data);
    } catch (error) {
      console.error(
        "Failed to create folder:",
        error,
      );
    } finally {
      setActionLoading(false);
    }
  };

  // -----------------------------------
  // Rename folder
  // -----------------------------------
  const handleRenameFolder = async (
    name: string,
  ) => {
    if (!folderToRename) {
      return;
    }

    setActionLoading(true);

    try {
      await renameDirectory(
        folderToRename._id,
        name,
      );

      setFolderToRename(null);

      // Get the latest data again
      const data = await getDirectoryItems(id);

      setDirectoryData(data);
    } catch (error) {
      console.error(
        "Failed to rename folder:",
        error,
      );
    } finally {
      setActionLoading(false);
    }
  };

  // -----------------------------------
  // Delete folder
  // -----------------------------------
  const handleDeleteFolder = async () => {
    if (!folderToDelete) {
      return;
    }

    setActionLoading(true);

    try {
      await deleteDirectory(
        folderToDelete._id,
      );

      setFolderToDelete(null);

      // Get the latest data again
      const data = await getDirectoryItems(id);

      setDirectoryData(data);
    } catch (error) {
      console.error(
        "Failed to delete folder:",
        error,
      );
    } finally {
      setActionLoading(false);
    }
  };

  // -----------------------------------
  // Loading
  // -----------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Sidebar
          activeRoot={isRoot}
          mobileOpen={mobileOpen}
          user={user}
          onHome={handleHome}
          onCloseMobile={() =>
            setMobileOpen(false)
          }
        />

        <div className="min-h-screen lg:ml-64">
          <Header
            user={user}
            search={search}
            onSearchChange={setSearch}
            onMenuClick={() =>
              setMobileOpen(true)
            }
            onProfileClick={() => {}}
            onShareClick={() => {}}
          />

          <main className="px-4 pb-6 pt-[80px] sm:px-6">
            <div className="flex min-h-[60vh] items-center justify-center">
              <p className="text-sm text-slate-500">
                Loading...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // -----------------------------------
  // Error
  // -----------------------------------
  if (!directoryData) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Sidebar
          activeRoot={isRoot}
          mobileOpen={mobileOpen}
          user={user}
          onHome={handleHome}
          onCloseMobile={() =>
            setMobileOpen(false)
          }
        />

        <div className="min-h-screen lg:ml-64">
          <Header
            user={user}
            search={search}
            onSearchChange={setSearch}
            onMenuClick={() =>
              setMobileOpen(true)
            }
            onProfileClick={() => {}}
            onShareClick={() => {}}
          />

          <main className="px-4 pb-6 pt-[80px] sm:px-6">
            <div className="flex min-h-[60vh] items-center justify-center">
              <p className="text-sm text-red-500">
                Failed to load this folder.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar
        activeRoot={isRoot}
        mobileOpen={mobileOpen}
        user={user}
        onHome={handleHome}
        onCloseMobile={() =>
          setMobileOpen(false)
        }
      />

      {/* Main */}
      <div className="min-h-screen lg:ml-64">
        <Header
          user={user}
          search={search}
          onSearchChange={setSearch}
          onMenuClick={() =>
            setMobileOpen(true)
          }
          onProfileClick={() => {}}
          onShareClick={() => {}}
        />

        <main className="px-4 pb-6 pt-[80px] sm:px-6">
          {/* Reserved space for breadcrumbs */}
          <div className="h-5">
            {/* Breadcrumbs later */}
          </div>

          {/* Current folder + buttons */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              {!isRoot && (
                <h1 className="truncate text-xl font-semibold text-slate-900">
                  {directoryData.directory.name}
                </h1>
              )}

              <p className="mt-1 text-sm text-slate-500">
                {totalItems}{" "}
                {totalItems === 1
                  ? "item"
                  : "items"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Upload */}
              <button
                type="button"
                onClick={() => {
                  // Upload will be implemented next.
                }}
                className="
                  inline-flex h-9
                  items-center gap-2
                  rounded-lg
                  bg-blue-600
                  px-3.5
                  text-sm font-medium
                  text-white
                  shadow-sm
                  hover:bg-blue-700
                "
              >
                <Upload size={16} />
                Upload
              </button>

              {/* New folder */}
              <button
                type="button"
                onClick={() =>
                  setCreateFolderOpen(true)
                }
                className="
                  inline-flex h-9
                  items-center gap-2
                  rounded-lg
                  border border-slate-200
                  bg-white
                  px-3.5
                  text-sm font-medium
                  text-slate-700
                  shadow-sm
                  hover:bg-slate-50
                "
              >
                <Plus size={16} />
                New folder
              </button>
            </div>
          </div>

          {/* Files + folders */}
          <DirectoryItemsView
            directories={directories}
            files={files}
            onOpenDirectory={
              handleOpenDirectory
            }

            /*
             * We will add file opening here
             * after updating DirectoryItemsView
             * to accept onOpenFile.
             */

            onDirectoryDetails={(
              directory,
            ) => {
              console.log(
                "Directory details:",
                directory,
              );
            }}

            onDirectoryDownload={(
              directory,
            ) => {
              console.log(
                "Directory download:",
                directory,
              );
            }}

            onDirectoryShare={(directory) => {
              console.log(
                "Directory share:",
                directory,
              );
            }}

            onDirectoryRename={(directory) => {
              setFolderToRename(directory);
            }}

            onDirectoryDelete={(directory) => {
              setFolderToDelete(directory);
            }}

            onFileDetails={(file) => {
              console.log(
                "File details:",
                file,
              );
            }}

            onFileDownload={(file) => {
              console.log(
                "File download:",
                file,
              );
            }}

            onFileShare={(file) => {
              console.log(
                "File share:",
                file,
              );
            }}

            onFileRename={(file) => {
              console.log(
                "File rename:",
                file,
              );
            }}

            onFileDelete={(file) => {
              console.log(
                "File delete:",
                file,
              );
            }}
          />

          {/* Create folder */}
          <CreateDirectoryModal
            open={createFolderOpen}
            onClose={() =>
              setCreateFolderOpen(false)
            }
            onSubmit={
              handleCreateFolder
            }
            loading={actionLoading}
          />

          {/* Rename folder */}
          <RenameModal
            open={
              folderToRename !== null
            }
            onClose={() =>
              setFolderToRename(null)
            }
            currentName={
              folderToRename?.name ?? ""
            }
            onSubmit={
              handleRenameFolder
            }
            loading={actionLoading}
          />

          {/* Delete folder */}
          <DeleteModal
            open={
              folderToDelete !== null
            }
            onClose={() =>
              setFolderToDelete(null)
            }
            itemName={
              folderToDelete?.name ?? ""
            }
            itemType="directory"
            onConfirm={
              handleDeleteFolder
            }
            loading={actionLoading}
          />
        </main>
      </div>
    </div>
  );
};

export default Home;