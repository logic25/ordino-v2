// Explicit list of all profile columns EXCEPT the compensation goal columns
// (monthly_goal, weekly_goal, accuracy_goal), which are no longer directly
// readable from the Data API. Use rpc('get_my_goals') or rpc('get_company_goals')
// to read goal values, and merge them in at the hook layer.
export const PROFILE_COLUMNS_NO_GOALS =
  "id,user_id,company_id,role,first_name,last_name,display_name,phone,avatar_url,preferences,is_active,created_at,updated_at,phone_extension,signature_data,about,carrier,job_title,notification_preferences,onboarding_completed,ooo_from,ooo_to,ooo_covering_pm_id,ooo_note,is_comp_admin";
