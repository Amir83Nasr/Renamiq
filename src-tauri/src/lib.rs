mod commands;
mod core;
mod database;
mod parser;
mod rename;
mod scanner;
#[cfg(test)]
mod tests;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
