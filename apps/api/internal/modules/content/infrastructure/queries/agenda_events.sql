-- name: ListAgendaEvents :many
SELECT * FROM agenda_events ORDER BY sort_order ASC;

-- name: GetAgendaEvent :one
SELECT * FROM agenda_events WHERE id = ? LIMIT 1;

-- name: CreateAgendaEvent :execlastid
INSERT INTO agenda_events (event_label, time_label, venue_name, venue_address, city, maps_url, sort_order)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: UpdateAgendaEvent :exec
UPDATE agenda_events SET event_label=?, time_label=?, venue_name=?, venue_address=?, city=?, maps_url=?, sort_order=?
WHERE id = ?;

-- name: DeleteAgendaEvent :exec
DELETE FROM agenda_events WHERE id = ?;
