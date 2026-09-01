package presentation

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"undangan-ariana-adrian/internal/modules/auth/application"
	"undangan-ariana-adrian/internal/shared/authmw"
	"undangan-ariana-adrian/internal/shared/pagination"
	"undangan-ariana-adrian/internal/shared/response"
)

type Handler struct {
	service *application.Service
}

func NewHandler(service *application.Service) *Handler {
	return &Handler{service: service}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Login menangani POST /api/v1/auth/login (PLAN.md §5.1).
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body", nil)
		return
	}
	if req.Username == "" || req.Password == "" {
		response.BadRequest(w, "Validation failed", map[string]string{"username": "required", "password": "required"})
		return
	}

	token, err := h.service.Authenticate(r.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, application.ErrInvalidCredentials) {
			response.Unauthorized(w, "Invalid username or password")
			return
		}
		response.Internal(w, "")
		return
	}

	response.OK(w, "Login successful", map[string]string{"token": token})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		response.BadRequest(w, "Invalid request body", nil)
		return false
	}
	return true
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch application.StatusHTTPCode(err) {
	case 400:
		response.BadRequest(w, err.Error(), nil)
	default:
		response.Internal(w, "")
	}
}

// --- admin: CRUD akun admin (fitur admin-users PLAN.md) ---

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	p := pagination.Parse(r)
	users, total, err := h.service.List(r.Context(), p)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OKPaginated(w, "Users retrieved successfully", users, pagination.Meta(p, total))
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var in application.CreateUserInput
	if !decodeJSON(w, r, &in) {
		return
	}
	user, err := h.service.Create(r.Context(), in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.Created(w, "User created successfully", user)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var in application.UpdateUserInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.Update(r.Context(), id, in); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "User updated successfully", nil)
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	claims, ok := authmw.ClaimsFromContext(r.Context())
	if !ok {
		response.Internal(w, "")
		return
	}
	if err := h.service.Delete(r.Context(), id, claims.AdminUserID); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "User deleted successfully", nil)
}
