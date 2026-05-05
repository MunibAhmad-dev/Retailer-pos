export const PRODUCT_TYPES = [
  { id: 'general', icon: '📦', label: 'General' },
  { id: 'mobile', icon: '📱', label: 'Mobile' },
  { id: 'laptop', icon: '💻', label: 'Laptop' },
  { id: 'accessories', icon: '🎧', label: 'Accessories' },
  { id: 'food', icon: '🍽', label: 'Restaurant' },
  { id: 'clothing', icon: '👕', label: 'Clothing' },
  { id: 'medicine', icon: '💊', label: 'Medicine' },
  { id: 'grocery', icon: '🛒', label: 'Grocery' },
];

export const PRODUCT_SCHEMAS: Record<string, any> = {
  general: {
    core: true,
    sections: []
  },
  mobile: {
    core: true,
    sections: [
      {
        title: 'Device Identity',
        fields: [
          { id: 'brand', label: 'Brand', type: 'select', opts: ['Samsung', 'Apple', 'Xiaomi', 'Oppo', 'Vivo', 'Tecno', 'Infinix', 'Realme', 'OnePlus', 'Huawei', 'Nokia', 'Other'] },
          { id: 'model_name', label: 'Model Name', type: 'text', ph: 'e.g. Galaxy A55' },
          { id: 'storage', label: 'Storage', type: 'select', opts: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'] },
          { id: 'ram', label: 'RAM', type: 'select', opts: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'] },
          { id: 'color', label: 'Color', type: 'text', ph: 'e.g. Midnight Black' },
          { id: 'condition', label: 'Condition', type: 'select', opts: ['New (Box Pack)', 'New (Open Box)', 'Refurbished – Grade A', 'Refurbished – Grade B', 'Used'] },
        ]
      },
      {
        title: 'Screen & Network',
        fields: [
          { id: 'display_size', label: 'Display Size', type: 'select', opts: ['4.7"', '5.0"', '5.5"', '6.0"', '6.1"', '6.4"', '6.5"', '6.7"', '6.8"', '7.0"'] },
          { id: 'sim_type', label: 'SIM Type', type: 'select', opts: ['Single SIM', 'Dual SIM', 'Dual SIM + eSIM', 'eSIM only'] },
          { id: 'network', label: 'Network', type: 'select', opts: ['5G', '4G LTE', '3G', 'Dual 5G', 'Dual 4G'] },
          { id: 'imei', label: 'IMEI / Serial', type: 'text', ph: '15-digit IMEI' },
        ]
      },
      {
        title: 'Variant Tags',
        tags: ['64GB', '128GB', '256GB', 'White', 'Black', 'Blue', 'Gold', 'PTA Approved', 'Dual SIM', '5G', 'Official', 'Box Pack', 'Warranty'],
      }
    ]
  },
  laptop: {
    core: true,
    sections: [
      {
        title: 'Processor & Performance',
        fields: [
          { id: 'brand', label: 'Brand', type: 'select', opts: ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer', 'Microsoft', 'MSI', 'Toshiba', 'Other'] },
          { id: 'processor_brand', label: 'Processor', type: 'select', opts: ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9', 'Apple M1', 'Apple M2', 'Apple M3', 'Apple M4', 'Qualcomm Snapdragon'] },
          { id: 'generation', label: 'Generation', type: 'select', opts: ['6th Gen', '7th Gen', '8th Gen', '9th Gen', '10th Gen', '11th Gen', '12th Gen', '13th Gen', '14th Gen', '15th Gen (Arrow Lake)'] },
          { id: 'ram', label: 'RAM', type: 'select', opts: ['4GB', '8GB', '12GB', '16GB', '24GB', '32GB', '48GB', '64GB'] },
          { id: 'storage_type', label: 'Storage', type: 'select', opts: ['256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD', '256GB HDD', '512GB HDD', '1TB HDD', '2TB HDD', '512GB SSD + 1TB HDD'] },
          { id: 'gpu', label: 'Graphics Card', type: 'select', opts: ['Integrated (Intel UHD)', 'Integrated (AMD Radeon)', 'NVIDIA MX450', 'NVIDIA GTX 1650', 'NVIDIA RTX 3050', 'NVIDIA RTX 3060', 'NVIDIA RTX 4060', 'NVIDIA RTX 4070', 'AMD RX 6600M', 'Apple GPU (M-series)'] },
        ]
      },
      {
        title: 'Display & Build',
        fields: [
          { id: 'display_size', label: 'Screen Size', type: 'select', opts: ['11"', '12"', '13"', '13.3"', '14"', '15"', '15.6"', '16"', '17"', '17.3"'] },
          { id: 'display_res', label: 'Resolution', type: 'select', opts: ['HD 1366x768', 'FHD 1920x1080', 'FHD+ 1920x1200', '2K 2560x1440', '4K 3840x2160'] },
          { id: 'display_type', label: 'Panel Type', type: 'select', opts: ['IPS', 'TN', 'VA', 'OLED', 'AMOLED', 'Mini-LED', 'Retina'] },
          { id: 'touch', label: 'Touchscreen', type: 'select', opts: ['No', 'Yes – 10pt', 'Yes – Stylus support'] },
          { id: 'condition', label: 'Condition', type: 'select', opts: ['New (Sealed)', 'New (Open Box)', 'Refurbished – Grade A', 'Refurbished – Grade B', 'Used'] },
          { id: 'os', label: 'OS', type: 'select', opts: ['Windows 11 Home', 'Windows 11 Pro', 'Windows 10', 'macOS', 'Linux', 'Chrome OS', 'No OS / DOS'] },
        ]
      },
      {
        title: 'Variant Tags',
        tags: ['i5', 'i7', 'i9', '16GB RAM', 'Backlit KB', 'Fingerprint', 'USB-C', 'Thunderbolt', '2-in-1', 'Slim', 'Gaming', 'Business', 'Sealed Box', 'Official Warranty'],
      }
    ]
  },
  accessories: {
    core: true,
    sections: [
      {
        title: 'Accessory Details',
        fields: [
          { id: 'acc_type', label: 'Type', type: 'select', opts: ['Earbuds / TWS', 'Headphones', 'Charger', 'Power Bank', 'Cable', 'Screen Guard', 'Case / Cover', 'Keyboard', 'Mouse', 'Webcam', 'Smart Watch', 'Tablet', 'Stylus', 'Other'] },
          { id: 'compatibility', label: 'Compatible With', type: 'text', ph: 'e.g. iPhone 15, Samsung S24' },
          { id: 'warranty', label: 'Warranty', type: 'select', opts: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years'] },
          { id: 'condition', label: 'Condition', type: 'select', opts: ['New', 'Refurbished', 'Used'] },
        ]
      }
    ]
  },
  food: {
    core: true,
    sections: [
      {
        title: 'Menu Item Details',
        fields: [
          { id: 'menu_cat', label: 'Menu Category', type: 'select', opts: ['Starter / Appetizer', 'Main Course', 'Grill & BBQ', 'Rice & Biryani', 'Burger & Sandwich', 'Pizza', 'Pasta', 'Chinese', 'Fast Food', 'Dessert', 'Beverages – Hot', 'Beverages – Cold', 'Shakes & Juices', 'Combo Meal', 'Family Deal', 'Bakery'] },
          { id: 'serving_size', label: 'Serving Size', type: 'select', opts: ['Single', 'Half', 'Full', 'Half Tray', 'Full Tray', 'Per Piece', 'Per Kg', 'Per Litre'] },
          { id: 'spice_level', label: 'Spice Level', type: 'select', opts: ['Mild', 'Medium', 'Spicy', 'Extra Spicy', 'Customizable'] },
          { id: 'diet_type', label: 'Diet Type', type: 'select', opts: ['Regular', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Jain'] },
        ]
      },
      {
        title: 'Add-ons & Tags',
        tags: ['Bestseller', 'Chef Special', 'New', 'Seasonal', 'Contains Nuts', 'Dairy-Free', 'Combo', 'Dine-in Only', 'Delivery Only', 'Spicy'],
      }
    ]
  },
  clothing: {
    core: true,
    sections: [
      {
        title: 'Clothing Details',
        fields: [
          { id: 'cl_type', label: 'Type', type: 'select', opts: ['Shirt', 'T-Shirt', 'Trousers', 'Jeans', 'Shalwar Kameez', 'Kurta', 'Jacket', 'Coat', 'Dress', 'Abaya', 'Dupatta', 'Saree', 'Undergarments', 'Kids Wear', 'Formal Suit', 'Other'] },
          { id: 'gender', label: 'For', type: 'select', opts: ['Men', 'Women', 'Boys', 'Girls', 'Unisex'] },
          { id: 'size', label: 'Size', type: 'select', opts: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Custom / Stitched'] },
          { id: 'fabric', label: 'Fabric', type: 'text', ph: 'e.g. Cotton, Lawn, Silk' },
          { id: 'color', label: 'Color', type: 'text', ph: 'e.g. Navy Blue' },
        ]
      },
      {
        title: 'Tags',
        tags: ['Stitched', 'Unstitched', 'Embroidered', 'Printed', 'Plain', 'Imported', 'Local', 'Ready to Wear', 'On Sale'],
      }
    ]
  },
  medicine: {
    core: true,
    sections: [
      {
        title: 'Medicine Details',
        fields: [
          { id: 'med_type', label: 'Type', type: 'select', opts: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream / Ointment', 'Drops', 'Inhaler', 'Powder', 'Patch', 'Suppository', 'IV Fluid', 'Other'] },
          { id: 'strength', label: 'Strength / Dose', type: 'text', ph: 'e.g. 500mg, 250ml' },
          { id: 'manufacturer', label: 'Manufacturer', type: 'text', ph: 'e.g. GSK, Getz, Abbott' },
          { id: 'strip_qty', label: 'Per Strip / Pack', type: 'text', ph: 'e.g. 10 tablets' },
          { id: 'expiry', label: 'Expiry Date', type: 'text', ph: 'MM/YYYY' },
          { id: 'requires_rx', label: 'Prescription', type: 'select', opts: ['OTC – No Rx needed', 'Requires Prescription'] },
        ]
      }
    ]
  },
  grocery: {
    core: true,
    sections: [
      {
        title: 'Grocery Details',
        fields: [
          { id: 'groc_cat', label: 'Sub-Category', type: 'select', opts: ['Rice & Grains', 'Flour & Pulses', 'Cooking Oil', 'Spices & Masala', 'Sugar & Salt', 'Dairy Products', 'Packaged Food', 'Snacks', 'Beverages', 'Frozen Food', 'Fresh Produce', 'Bakery Items', 'Condiments', 'Cleaning & Household', 'Baby Products', 'Personal Care'] },
          { id: 'brand', label: 'Brand', type: 'text', ph: 'e.g. National, Shan, Rafhan' },
          { id: 'weight_vol', label: 'Weight / Volume', type: 'text', ph: 'e.g. 1kg, 500ml' },
          { id: 'shelf_life', label: 'Shelf Life', type: 'text', ph: 'e.g. 6 months' },
        ]
      }
    ]
  }
};
