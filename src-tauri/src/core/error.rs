use serde::Serialize;

/// User-facing error: readable message plus technical detail logged separately.
#[derive(Debug, thiserror::Error)]
pub enum RenamiqError {
    #[error("{message}")]
    User {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
}

impl RenamiqError {
    pub fn user(message: impl Into<String>) -> Self {
        RenamiqError::User {
            message: message.into(),
            source: None,
        }
    }

    pub fn with_source(
        message: impl Into<String>,
        source: impl Into<Box<dyn std::error::Error + Send + Sync>>,
    ) -> Self {
        RenamiqError::User {
            message: message.into(),
            source: Some(source.into()),
        }
    }
}

/// Serializable payload sent to the frontend.
#[derive(Serialize)]
pub struct ErrorPayload {
    pub message: String,
}

impl From<RenamiqError> for ErrorPayload {
    fn from(err: RenamiqError) -> Self {
        // Technical detail (error chain) goes to stderr for debugging logs.
        if let Some(source) = err.source() {
            eprintln!("[renamiq] cause: {source}");
            let mut src = source.source();
            while let Some(s) = src {
                eprintln!("[renamiq] caused by: {s}");
                src = s.source();
            }
        }
        ErrorPayload {
            message: err.to_string(),
        }
    }
}

pub type AppResult<T> = Result<T, RenamiqError>;
