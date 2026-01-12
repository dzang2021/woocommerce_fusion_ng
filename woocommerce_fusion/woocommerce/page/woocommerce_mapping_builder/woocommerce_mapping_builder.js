frappe.pages["woocommerce-mapping-builder"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("WooCommerce Mapping Builder"),
		single_column: true,
	});

	const state = {
		servers: [],
		itemFields: [],
		wcFields: [],
		mappings: [],
		selectedItem: null,
		selectedWc: null,
		server: null,
		productId: null,
	};

	page.set_primary_action(__("Save"), () => saveMappings(state, page));

	const container = $(wrapper).find(".layout-main-section");
	container.html(`
		<div class="mapping-builder">
			<div class="form-grid">
				<div class="form-column">
					<div class="form-group">
						<label>${__("WooCommerce Server")}</label>
						<select class="form-control wb-server"></select>
					</div>
				</div>
				<div class="form-column">
					<div class="form-group">
						<label>${__("Example Product ID (for meta_data keys)")}</label>
						<input type="number" class="form-control wb-product-id" placeholder="2595">
					</div>
				</div>
				<div class="form-column">
					<div class="form-group">
						<label>&nbsp;</label>
						<button class="btn btn-secondary wb-load">${__("Load Fields")}</button>
					</div>
				</div>
			</div>
			<div class="mapping-columns">
				<div class="mapping-column">
					<div class="mapping-header">${__("ERPNext Item Fields")}</div>
					<input type="text" class="form-control wb-search-item" placeholder="${__("Search ERPNext fields")}">
					<ul class="mapping-list wb-item-list"></ul>
				</div>
				<div class="mapping-column">
					<div class="mapping-header">${__("WooCommerce Fields")}</div>
					<input type="text" class="form-control wb-search-wc" placeholder="${__("Search WooCommerce fields")}">
					<ul class="mapping-list wb-wc-list"></ul>
				</div>
			</div>
			<div class="mapping-actions">
				<button class="btn btn-primary wb-map">${__("Add Mapping")}</button>
				<button class="btn btn-default wb-clear">${__("Clear Selection")}</button>
			</div>
			<div class="mapping-table">
				<div class="mapping-header">${__("Current Mappings")}</div>
				<table class="table table-bordered">
					<thead>
						<tr>
							<th>${__("ERPNext Field")}</th>
							<th>${__("WooCommerce JSONPath")}</th>
							<th></th>
						</tr>
					</thead>
					<tbody class="wb-mapping-body"></tbody>
				</table>
			</div>
		</div>
	`);

	const serverSelect = container.find(".wb-server");
	const productInput = container.find(".wb-product-id");
	const itemList = container.find(".wb-item-list");
	const wcList = container.find(".wb-wc-list");
	const mappingBody = container.find(".wb-mapping-body");

	container.find(".wb-load").on("click", () => loadFields(state, container));
	container.find(".wb-map").on("click", () => addMapping(state, container));
	container.find(".wb-clear").on("click", () => clearSelection(state, container));
	container.find(".wb-search-item").on("input", () => renderItemFields(state, container));
	container.find(".wb-search-wc").on("input", () => renderWcFields(state, container));

	frappe.call({
		method: "woocommerce_fusion.woocommerce.mapping_builder.get_woocommerce_servers",
		callback: function (r) {
			state.servers = r.message || [];
			serverSelect.empty();
			serverSelect.append(`<option value="">${__("Select server")}</option>`);
			state.servers.forEach((server) => {
				serverSelect.append(`<option value="${server.name}">${server.name}</option>`);
			});
		},
	});

	serverSelect.on("change", function () {
		state.server = $(this).val();
		loadExistingMappings(state, container);
	});

	productInput.on("change", function () {
		state.productId = $(this).val();
	});

	function renderItemFields(state, container) {
		const term = container.find(".wb-search-item").val().toLowerCase();
		itemList.empty();
		(state.itemFields || [])
			.filter((field) => {
				const label = `${field.fieldname} | ${field.label || ""}`.toLowerCase();
				return !term || label.includes(term);
			})
			.forEach((field) => {
				const label = `${field.fieldname} | ${field.label || ""}`;
				const li = $(`<li>${label}</li>`);
				if (state.selectedItem === label) {
					li.addClass("active");
				}
				li.on("click", () => {
					state.selectedItem = label;
					renderItemFields(state, container);
				});
				itemList.append(li);
			});
	}

	function renderWcFields(state, container) {
		const term = container.find(".wb-search-wc").val().toLowerCase();
		wcList.empty();
		(state.wcFields || [])
			.filter((field) => {
				const label = `${field.label} ${field.jsonpath}`.toLowerCase();
				return !term || label.includes(term);
			})
			.forEach((field) => {
				const li = $(`<li>${field.label} <small>${field.jsonpath}</small></li>`);
				if (state.selectedWc === field.jsonpath) {
					li.addClass("active");
				}
				li.on("click", () => {
					state.selectedWc = field.jsonpath;
					renderWcFields(state, container);
				});
				wcList.append(li);
			});
	}

	function renderMappings(state, container) {
		mappingBody.empty();
		(state.mappings || []).forEach((row, idx) => {
			const tr = $(`
				<tr>
					<td>${row.erpnext_field_name}</td>
					<td>${row.woocommerce_field_name}</td>
					<td><button class="btn btn-xs btn-danger">×</button></td>
				</tr>
			`);
			tr.find("button").on("click", () => {
				state.mappings.splice(idx, 1);
				renderMappings(state, container);
			});
			mappingBody.append(tr);
		});
	}

	function loadFields(state, container) {
		if (!state.server) {
			frappe.msgprint(__("Select a WooCommerce Server first."));
			return;
		}
		if (!state.productId) {
			frappe.msgprint(__("Enter an example Product ID to load meta_data keys."));
			return;
		}

		frappe.call({
			method: "woocommerce_fusion.woocommerce.mapping_builder.get_item_fields",
			args: { woocommerce_server: state.server },
			callback: function (r) {
				state.itemFields = r.message || [];
				renderItemFields(state, container);
			},
		});

		frappe.call({
			method: "woocommerce_fusion.woocommerce.mapping_builder.get_woocommerce_product_fields",
			args: { woocommerce_server: state.server, product_id: state.productId },
			callback: function (r) {
				const data = r.message || { fields: [], meta_fields: [] };
				state.wcFields = [...data.fields, ...data.meta_fields];
				renderWcFields(state, container);
			},
		});
	}

	function addMapping(state, container) {
		if (!state.selectedItem || !state.selectedWc) {
			frappe.msgprint(__("Select both ERPNext and WooCommerce fields first."));
			return;
		}
		const exists = state.mappings.some(
			(row) =>
				row.erpnext_field_name === state.selectedItem &&
				row.woocommerce_field_name === state.selectedWc
		);
		if (!exists) {
			state.mappings.push({
				erpnext_field_name: state.selectedItem,
				woocommerce_field_name: state.selectedWc,
			});
		}
		renderMappings(state, container);
	}

	function clearSelection(state, container) {
		state.selectedItem = null;
		state.selectedWc = null;
		renderItemFields(state, container);
		renderWcFields(state, container);
	}

	function loadExistingMappings(state, container) {
		if (!state.server) {
			return;
		}
		frappe.call({
			method: "woocommerce_fusion.woocommerce.mapping_builder.get_existing_mappings",
			args: { woocommerce_server: state.server },
			callback: function (r) {
				state.mappings = r.message || [];
				renderMappings(state, container);
			},
		});
	}

	function saveMappings(state, page) {
		if (!state.server) {
			frappe.msgprint(__("Select a WooCommerce Server first."));
			return;
		}
		frappe.call({
			method: "woocommerce_fusion.woocommerce.mapping_builder.save_item_field_mappings",
			args: {
				woocommerce_server: state.server,
				mappings: state.mappings || [],
			},
			callback: function () {
				frappe.show_alert({ message: __("Mappings saved"), indicator: "green" });
			},
		});
	}
};
