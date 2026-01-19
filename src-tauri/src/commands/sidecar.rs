use std::path::PathBuf;
use std::process::{Command, Output, Stdio};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

/// Get the path to ffmpeg binary (sidecar or system)
pub fn get_ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    // Try sidecar first (bundled binary)
    if app.shell().sidecar("ffmpeg").is_ok() {
        // The sidecar command has the correct path internally
        // We need to get its program path
        return Ok(get_sidecar_path(app, "ffmpeg"));
    }

    // Fall back to system ffmpeg
    if let Ok(output) = Command::new("which").arg("ffmpeg").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(PathBuf::from(path));
        }
    }

    Err("FFmpeg not found. Please install FFmpeg.".to_string())
}

/// Get the path to ffprobe binary (sidecar or system)
pub fn get_ffprobe_path(app: &AppHandle) -> Result<PathBuf, String> {
    // Try sidecar first (bundled binary)
    if let Ok(_sidecar) = app.shell().sidecar("ffprobe") {
        return Ok(get_sidecar_path(app, "ffprobe"));
    }

    // Fall back to system ffprobe
    if let Ok(output) = Command::new("which").arg("ffprobe").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(PathBuf::from(path));
        }
    }

    Err("FFprobe not found. Please install FFmpeg.".to_string())
}

/// Get the full path to a sidecar binary
fn get_sidecar_path(app: &AppHandle, name: &str) -> PathBuf {
    // In production, sidecars are in the Resources folder
    // The path is: AppBundle/Contents/MacOS/<name> or Resources/binaries/<name>

    // Try using the resource resolver
    if let Ok(resource_dir) = app.path().resource_dir() {
        let sidecar_path: PathBuf = resource_dir.join("binaries").join(name);
        if sidecar_path.exists() {
            return sidecar_path;
        }
    }

    // For macOS app bundles, sidecars are in Contents/MacOS/
    if let Ok(exe_dir) = std::env::current_exe() {
        if let Some(parent) = exe_dir.parent() {
            let sidecar_path = parent.join(name);
            if sidecar_path.exists() {
                return sidecar_path;
            }
        }
    }

    // Fall back to just the name (will use system PATH)
    PathBuf::from(name)
}

/// Run ffmpeg with the given arguments
pub fn run_ffmpeg_command(app: &AppHandle, args: &[String]) -> Result<Output, String> {
    let ffmpeg_path = get_ffmpeg_path(app)?;

    Command::new(&ffmpeg_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))
}

/// Run ffprobe with the given arguments
#[allow(dead_code)]
pub fn run_ffprobe_command(app: &AppHandle, args: &[&str]) -> Result<Output, String> {
    let ffprobe_path = get_ffprobe_path(app)?;

    Command::new(&ffprobe_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))
}

/// Check if ffmpeg is available (bundled or system)
pub fn is_ffmpeg_available(app: &AppHandle) -> bool {
    get_ffmpeg_path(app).is_ok()
}

/// Get ffmpeg version string
pub fn get_ffmpeg_version_string(app: &AppHandle) -> Result<String, String> {
    let output = run_ffmpeg_command(app, &["-version".to_string()])?;

    if !output.status.success() {
        return Err("Failed to get ffmpeg version".to_string());
    }

    let version_output = String::from_utf8_lossy(&output.stdout);
    let first_line = version_output.lines().next().unwrap_or("Unknown version");
    Ok(first_line.to_string())
}
