use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{command, AppHandle};

use super::sidecar::{is_ffmpeg_available, get_ffmpeg_version_string};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_directory: bool,
}

/// Get the default Downloads directory path
#[command]
pub async fn get_downloads_path() -> Result<String, String> {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not find Downloads directory".to_string())
}

/// Get the user's home directory path
#[command]
pub async fn get_home_path() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not find home directory".to_string())
}

/// Check if ffmpeg is available (bundled or system)
#[command]
pub async fn check_ffmpeg(app: AppHandle) -> Result<bool, String> {
    Ok(is_ffmpeg_available(&app))
}

/// Get ffmpeg version string
#[command]
pub async fn get_ffmpeg_version(app: AppHandle) -> Result<String, String> {
    get_ffmpeg_version_string(&app)
}

/// Open a file or directory in Finder
#[command]
pub async fn open_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new(&path)))
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

/// Generate a unique output filename
#[command]
pub async fn generate_output_filename(preset_name: String) -> Result<String, String> {
    let downloads = dirs::download_dir()
        .ok_or_else(|| "Could not find Downloads directory".to_string())?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let safe_preset = preset_name
        .replace(' ', "-")
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "")
        .to_lowercase();

    let filename = format!("snappy-{}-{}.mp4", safe_preset, timestamp);
    let output_path = downloads.join(filename);

    Ok(output_path.to_string_lossy().to_string())
}

/// Get file info for a given path
#[command]
pub async fn get_file_info(path: String) -> Result<FileInfo, String> {
    let path_buf = PathBuf::from(&path);
    let metadata = std::fs::metadata(&path_buf)
        .map_err(|e| format!("Failed to get file info: {}", e))?;

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(FileInfo {
        path,
        name,
        size: metadata.len(),
        is_directory: metadata.is_dir(),
    })
}

/// Check if a file exists
#[command]
pub async fn file_exists(path: String) -> bool {
    PathBuf::from(&path).exists()
}

/// Create a temporary directory for processing
#[command]
pub async fn create_temp_dir() -> Result<String, String> {
    let temp_dir = tempfile::tempdir()
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // We need to keep the temp dir alive, so we use keep() which
    // prevents automatic cleanup and returns the path
    let path = temp_dir.keep();
    Ok(path.to_string_lossy().to_string())
}

/// Clean up a temporary directory
#[command]
pub async fn cleanup_temp_dir(path: String) -> Result<(), String> {
    std::fs::remove_dir_all(&path)
        .map_err(|e| format!("Failed to cleanup temp directory: {}", e))
}
