// Package response menyediakan envelope JSON standar proyek (api-standard.md).
package response

import (
	"encoding/json"
	"net/http"
)

type envelope struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
	Errors  any    `json:"errors,omitempty"`
	Meta    any    `json:"meta,omitempty"`
}

// PageMeta sesuai format paginasi api-standard.md.
type PageMeta struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

func write(w http.ResponseWriter, status int, env envelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(env)
}

func OK(w http.ResponseWriter, message string, data any) {
	write(w, http.StatusOK, envelope{Success: true, Message: message, Data: data})
}

func OKPaginated(w http.ResponseWriter, message string, data any, meta PageMeta) {
	write(w, http.StatusOK, envelope{Success: true, Message: message, Data: data, Meta: meta})
}

func Created(w http.ResponseWriter, message string, data any) {
	write(w, http.StatusCreated, envelope{Success: true, Message: message, Data: data})
}

func Error(w http.ResponseWriter, status int, message string, errs any) {
	write(w, status, envelope{Success: false, Message: message, Errors: errs})
}

func BadRequest(w http.ResponseWriter, message string, errs any) {
	Error(w, http.StatusBadRequest, message, errs)
}

func Unauthorized(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Unauthorized"
	}
	Error(w, http.StatusUnauthorized, message, nil)
}

func NotFound(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Not found"
	}
	Error(w, http.StatusNotFound, message, nil)
}

func Internal(w http.ResponseWriter, message string) {
	if message == "" {
		message = "Internal server error"
	}
	Error(w, http.StatusInternalServerError, message, nil)
}

// NotFoundJSON menulis 404 JSON polos - dipakai fallback router untuk method
// non-GET (keputusan #17/PLAN.md F17), supaya request POST legacy yang
// nyasar ke path tak dikenal TIDAK PERNAH menerima balasan HTML.
func NotFoundJSON(w http.ResponseWriter, r *http.Request) {
	NotFound(w, "Route not found: "+r.Method+" "+r.URL.Path)
}
