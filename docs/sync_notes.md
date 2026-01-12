## WooCommerce Fusion sync notes (2026-01-11)

### Current status
- Sync errors are now centered on WooCommerce API rejecting payload fields `status` and `categories` when sent with invalid types.
- The ERPNext mapping currently includes:
  - `description` -> `$.description`
  - `custom_kurzbeschreibung` -> `$.short_description`
  - `item_code` -> `$.sku`
  - `custom_produktsicherheitshinweise` -> `$.safety_instructions`
  - `disabled` -> `$.status`
  - `is_stock_item` -> `$.manage_stock`
  - `item_group` -> `$.categories`

### Implemented changes (code-side)
- Added defensive guards to skip missing mappings and unsafe mappings.
- Added meta_data mapping support using JSONPath `$.meta_data.<key>`.
- Added special handling for `disabled -> status` and `item_group -> categories`.
- Added normalization before WooCommerce update:
  - `status` is coerced to a string when possible; invalid values are removed.
  - `categories` is coerced to a list of objects when possible; invalid values are removed.
- Added block to prevent manual mapping of `image` and `name` fields.
- Added retry logic for `TimestampMismatchError` on ERPNext item save.

### Persistent error
- WooCommerce API still rejects payload with:
  - `status` not a string
  - `categories[0]` not an object
- Example response (abbrev):
  - `Response Code: 400`
  - `Response Text: rest_invalid_param (status, categories)`
  - Request Body still shows `"status": 0` and `"categories": "Products"`

### Suspicion
- The outgoing payload is still being built from values that are not normalized
  before the API call, or `record` values are being overridden after normalization.
- The error indicates the payload has not been corrected to string/object types.

### Next steps
1) Inspect WooCommerce API payload right before `api.put` to confirm the final
   `record` values for `status` and `categories`.
2) Consider removing `status` and `categories` from the payload at the point
   of `db_update` if they are not in correct types.
3) Consider removing/adjusting `disabled -> $.status` mapping if WooCommerce
   should not be updated from ERPNext in this case.
4) Optional: Add a short log that prints outgoing `record` for these fields
   only, for one sync run.

