mod commands;

use commands::{
    ffmpeg::{export_video, get_video_duration},
    files::{
        check_ffmpeg, cleanup_temp_dir, create_temp_dir, file_exists,
        generate_output_filename, get_downloads_path, get_ffmpeg_version,
        get_file_info, get_home_path, open_in_finder,
    },
    metadata::{get_media_metadata, get_media_metadata_batch, generate_thumbnail, generate_thumbnails_batch},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // FFmpeg commands
            export_video,
            get_video_duration,
            // File commands
            check_ffmpeg,
            get_ffmpeg_version,
            get_downloads_path,
            get_home_path,
            open_in_finder,
            generate_output_filename,
            get_file_info,
            file_exists,
            create_temp_dir,
            cleanup_temp_dir,
            // Metadata commands
            get_media_metadata,
            get_media_metadata_batch,
            generate_thumbnail,
            generate_thumbnails_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
