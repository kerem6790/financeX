#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection, OptionalExtension};
use std::{fs, sync::Mutex};
use tauri::{Manager, State};

const DB_FILE_NAME: &str = "financex.db";
const TABLE_KV: &str = "kv_store";
const APP_STATE_KEY: &str = "app_state";

struct AppDatabase(Mutex<Connection>);

impl AppDatabase {
    fn new(connection: Connection) -> Self {
        Self(Mutex::new(connection))
    }

    fn with_conn<R, F>(&self, action: F) -> Result<R, String>
    where
        F: FnOnce(&Connection) -> Result<R, rusqlite::Error>,
    {
        let conn = self.0.lock().map_err(|_| "Veritabanı kilidi alınamadı".to_string())?;
        action(&conn).map_err(|err| err.to_string())
    }
}

#[tauri::command]
fn load_state(database: State<AppDatabase>) -> Result<Option<String>, String> {
    database.with_conn(|conn| {
        conn.query_row(
            &format!("SELECT value FROM {} WHERE key = ?1", TABLE_KV),
            params![APP_STATE_KEY],
            |row| row.get::<_, String>(0),
        )
        .optional()
    })
}

#[tauri::command]
fn save_state(state: String, database: State<AppDatabase>) -> Result<(), String> {
    database.with_conn(|conn| {
        conn.execute(
            &format!(
                "INSERT INTO {} (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                TABLE_KV
            ),
            params![APP_STATE_KEY, state],
        )
        .map(|_| ())
    })
}

fn initialise_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    let app_dir = app
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Uygulama veri dizini oluşturulamadı".to_string())?;
    fs::create_dir_all(&app_dir).map_err(|err| err.to_string())?;

    let db_path = app_dir.join(DB_FILE_NAME);
    let connection = Connection::open(db_path).map_err(|err| err.to_string())?;
    connection
        .execute(
            &format!(
                "CREATE TABLE IF NOT EXISTS {} (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )",
                TABLE_KV
            ),
            [],
        )
        .map_err(|err| err.to_string())?;

    Ok(connection)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            let connection = initialise_database(&app_handle)?;
            app.manage(AppDatabase::new(connection));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_state, save_state])
        .run(tauri::generate_context!())
        .expect("Tauri uygulaması çalıştırılırken hata oluştu");
}
