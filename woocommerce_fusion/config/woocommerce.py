from frappe import _


def get_data():
	return [
		{
			"label": _("Tools"),
			"items": [
				{
					"type": "page",
					"name": "woocommerce-mapping-builder",
					"label": _("WooCommerce Mapping Builder"),
				},
			],
		}
	]
