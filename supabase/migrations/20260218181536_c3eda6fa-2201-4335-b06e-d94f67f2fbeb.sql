
-- Enable reports for admin and accounting roles
UPDATE role_permissions SET enabled = true, can_list = true, can_show = true, can_create = false, can_update = false, can_delete = false
WHERE resource = 'reports' AND role IN ('admin', 'accounting');
