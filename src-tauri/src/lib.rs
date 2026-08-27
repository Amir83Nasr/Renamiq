mod commands;
mod core;
mod database;
mod media;
mod parser;
mod rename;
mod scanner;
#[cfg(test)]
mod subkade_live_test;
#[cfg(test)]
mod tests;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .format(|out, message, record| {
                    out.finish(format_args!(
                        "[{}] {}",
                        record.level(),
                        message.to_string().to_uppercase()
                    ))
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window_vibrancy::apply_vibrancy(
                        &window,
                        window_vibrancy::NSVisualEffectMaterial::Sidebar,
                        None,
                        None,
                    );

                    // Prevent stealing focus on startup/dev restart on macOS
                    #[allow(unexpected_cfgs)]
                    unsafe {
                        use objc::*;
                        let ns_app: *mut objc::runtime::Object = msg_send![class!(NSApplication), sharedApplication];
                        let _: () = msg_send![ns_app, hide: std::ptr::null_mut::<()>()];
                        let _: () = msg_send![ns_app, unhideWithoutActivation];
                    }
                }
            }

            let data_dir = app.path().app_data_dir()?;
            let db = database::open(&database::default_db_path(&data_dir))?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_folder,
            commands::scan_paths,
            commands::build_rename_plan,
            commands::execute_operations,
            commands::list_operations,
            commands::undo_last_operation,
            commands::get_settings,
            commands::set_setting,
            commands::subkade_search,
            commands::subkade_download,
            commands::subkade_download_to_folder,
            commands::subkade_zip_size,
            commands::embed_subtitle,
            commands::remove_subtitle,
            commands::tmdb_search,
            commands::tmdb_download_poster,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
