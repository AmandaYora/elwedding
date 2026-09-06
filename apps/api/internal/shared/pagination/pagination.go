// Package pagination berisi parsing `?page=&limit=` yang seragam untuk
// seluruh endpoint admin yang mengembalikan list (api-standard.md).
package pagination

import (
	"net/http"
	"strconv"

	"undangan-digital/internal/shared/response"
)

const (
	DefaultLimit = 10
	MaxLimit     = 100
)

type Params struct {
	Page  int
	Limit int
}

func (p Params) Offset() int {
	return (p.Page - 1) * p.Limit
}

func Parse(r *http.Request) Params {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = DefaultLimit
	}
	if limit > MaxLimit {
		limit = MaxLimit
	}
	return Params{Page: page, Limit: limit}
}

func Meta(p Params, total int) response.PageMeta {
	totalPages := (total + p.Limit - 1) / p.Limit
	if totalPages < 1 {
		totalPages = 1
	}
	return response.PageMeta{Page: p.Page, Limit: p.Limit, Total: total, TotalPages: totalPages}
}
