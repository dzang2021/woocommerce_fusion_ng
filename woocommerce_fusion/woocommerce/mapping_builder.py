from __future__ import annotations

from typing import Dict, List

import frappe
from frappe import _
from woocommerce import API

from woocommerce_fusion.woocommerce.woocommerce_api import verify_ssl


@frappe.whitelist()
def get_woocommerce_servers() -> List[Dict]:
	return frappe.get_all(
		"WooCommerce Server",
		fields=["name", "woocommerce_server_url"],
		order_by="name",
	)


@frappe.whitelist()
def get_item_fields(woocommerce_server: str) -> List[Dict]:
	server = frappe.get_doc("WooCommerce Server", woocommerce_server)
	fields = server.get_item_docfields("Item")
	fields.append(
		{
			"label": _("Item Price (Price List)"),
			"fieldname": "item_price",
		}
	)
	return sorted(fields, key=lambda field: (field.get("label") or "", field.get("fieldname") or ""))


@frappe.whitelist()
def get_existing_mappings(woocommerce_server: str) -> List[Dict]:
	server = frappe.get_doc("WooCommerce Server", woocommerce_server)
	return [
		{
			"erpnext_field_name": row.erpnext_field_name,
			"woocommerce_field_name": row.woocommerce_field_name,
		}
		for row in (server.item_field_map or [])
	]


@frappe.whitelist()
def get_woocommerce_product_fields(woocommerce_server: str, product_id: int) -> Dict:
	server = frappe.get_doc("WooCommerce Server", woocommerce_server)
	if not product_id:
		frappe.throw(_("Product ID is required"))

	api = API(
		url=server.woocommerce_server_url,
		consumer_key=server.api_consumer_key,
		consumer_secret=server.api_consumer_secret,
		version="wc/v3",
		timeout=40,
		verify_ssl=verify_ssl,
	)
	product = api.get(f"products/{product_id}").json()
	if not isinstance(product, dict) or "id" not in product:
		frappe.throw(_("Failed to fetch WooCommerce product fields"))

	meta_keys = []
	for entry in product.get("meta_data") or []:
		if isinstance(entry, dict) and entry.get("key"):
			meta_keys.append(entry["key"])

	fields = []
	for key in sorted(product.keys()):
		if key in {"_links", "meta_data"}:
			continue
		fields.append(
			{
				"label": key,
				"jsonpath": f"$.{key}",
			}
		)
	if "images" in product:
		fields.append(
			{
				"label": "images[0].src",
				"jsonpath": "$.images[0].src",
			}
		)

	meta_fields = [
		{
			"label": f"meta_data.{key}",
			"jsonpath": f"$.meta_data.{key}",
		}
		for key in sorted(set(meta_keys))
	]

	return {
		"fields": fields,
		"meta_fields": meta_fields,
	}


@frappe.whitelist()
def save_item_field_mappings(woocommerce_server: str, mappings: List[Dict]) -> None:
	if not woocommerce_server:
		frappe.throw(_("WooCommerce Server is required"))
	if isinstance(mappings, str):
		mappings = frappe.parse_json(mappings)
	server = frappe.get_doc("WooCommerce Server", woocommerce_server)
	server.set("item_field_map", [])

	for row in mappings or []:
		erpnext_field_name = row.get("erpnext_field_name")
		woocommerce_field_name = row.get("woocommerce_field_name")
		if not (erpnext_field_name and woocommerce_field_name):
			continue
		server.append(
			"item_field_map",
			{
				"erpnext_field_name": erpnext_field_name,
				"woocommerce_field_name": woocommerce_field_name,
			},
		)

	server.save()
