#!/usr/bin/env python3
"""
VivaLusa E-commerce Backend API Testing
Tests all backend endpoints for the cosmetic products website
"""

import requests
import sys
import json
from datetime import datetime

class VivaLusaAPITester:
    def __init__(self, base_url="https://beauty-checkout-12.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session = requests.Session()
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "error": details})

    def test_api_endpoint(self, method, endpoint, expected_status, data=None, headers=None, cookies=None):
        """Generic API test method"""
        url = f"{self.api_url}/{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        if headers:
            req_headers.update(headers)
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=req_headers, cookies=cookies)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=req_headers, cookies=cookies)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=req_headers, cookies=cookies)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=req_headers, cookies=cookies)
            
            success = response.status_code == expected_status
            return success, response
        except Exception as e:
            return False, str(e)

    def test_products_api(self):
        """Test product-related endpoints"""
        print("\n🛍️ Testing Product APIs...")
        
        # Test GET /api/products
        success, response = self.test_api_endpoint('GET', 'products', 200)
        if success:
            products = response.json()
            self.log_test("GET /api/products", len(products) == 6, f"Expected 6 products, got {len(products)}")
            self.products = products
        else:
            self.log_test("GET /api/products", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")
            return

        # Test GET /api/products/categories
        success, response = self.test_api_endpoint('GET', 'products/categories', 200)
        if success:
            categories = response.json()
            expected_categories = ['Skincare', 'Makeup', 'Fragrance']
            has_expected = all(cat in categories for cat in expected_categories)
            self.log_test("GET /api/products/categories", has_expected, f"Categories: {categories}")
        else:
            self.log_test("GET /api/products/categories", False, f"Status: {response.status_code}")

        # Test GET /api/products/{id} with first product
        if hasattr(self, 'products') and self.products:
            product_id = self.products[0]['id']
            success, response = self.test_api_endpoint('GET', f'products/{product_id}', 200)
            if success:
                product = response.json()
                self.log_test("GET /api/products/{id}", product['id'] == product_id)
            else:
                self.log_test("GET /api/products/{id}", False, f"Status: {response.status_code}")

        # Test GET /api/products/category/{category}
        success, response = self.test_api_endpoint('GET', 'products/category/Skincare', 200)
        if success:
            skincare_products = response.json()
            self.log_test("GET /api/products/category/Skincare", len(skincare_products) >= 1)
        else:
            self.log_test("GET /api/products/category/Skincare", False, f"Status: {response.status_code}")

    def test_auth_api(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication APIs...")
        
        # Test admin login
        admin_data = {
            "email": "admin@vivalusa.com",
            "password": "VivaLusa2024!"
        }
        success, response = self.test_api_endpoint('POST', 'auth/login', 200, admin_data)
        if success:
            self.log_test("POST /api/auth/login (admin)", True)
            # Store cookies for authenticated requests
            self.admin_cookies = response.cookies
        else:
            self.log_test("POST /api/auth/login (admin)", False, f"Status: {response.status_code}")
            return

        # Test GET /api/auth/me with admin
        success, response = self.test_api_endpoint('GET', 'auth/me', 200, cookies=self.admin_cookies)
        if success:
            user_data = response.json()
            is_admin = user_data.get('role') == 'admin'
            self.log_test("GET /api/auth/me (admin)", is_admin, f"Role: {user_data.get('role')}")
        else:
            self.log_test("GET /api/auth/me (admin)", False, f"Status: {response.status_code}")

        # Test user registration
        test_user_data = {
            "name": "Test User",
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!"
        }
        success, response = self.test_api_endpoint('POST', 'auth/register', 200, test_user_data)
        if success:
            self.log_test("POST /api/auth/register", True)
            self.user_cookies = response.cookies
            self.test_user_email = test_user_data['email']
        else:
            self.log_test("POST /api/auth/register", False, f"Status: {response.status_code}")

        # Test logout
        success, response = self.test_api_endpoint('POST', 'auth/logout', 200, cookies=self.admin_cookies)
        self.log_test("POST /api/auth/logout", success)

    def test_shipping_api(self):
        """Test European shipping calculation system"""
        print("\n🚚 Testing European Shipping API...")
        
        # Test GET /api/shipping/countries
        success, response = self.test_api_endpoint('GET', 'shipping/countries', 200)
        if success:
            countries = response.json()
            country_count = len(countries)
            has_portugal = any(c['value'] == 'portugal' for c in countries)
            has_spain = any(c['value'] == 'spain' for c in countries)
            has_france = any(c['value'] == 'france' for c in countries)
            has_uk = any(c['value'] == 'united kingdom' for c in countries)
            
            self.log_test("GET /api/shipping/countries", 
                         country_count >= 30 and has_portugal and has_spain and has_france and has_uk,
                         f"Found {country_count} countries, Portugal: {has_portugal}, Spain: {has_spain}, France: {has_france}, UK: {has_uk}")
        else:
            self.log_test("GET /api/shipping/countries", False, f"Status: {response.status_code}")
        
        # Test Portugal (Domestic zone - €3.99)
        portugal_data = {"country": "portugal", "zip_code": "4505-609"}
        success, response = self.test_api_endpoint('POST', 'shipping/calculate', 200, portugal_data)
        if success:
            shipping_info = response.json()
            correct_cost = shipping_info.get('shipping_cost') == 3.99
            correct_zone = shipping_info.get('zone') == 'Domestic'
            has_estimate = 'estimate' in shipping_info
            self.log_test("POST /api/shipping/calculate (Portugal)", 
                         correct_cost and correct_zone and has_estimate,
                         f"Cost: €{shipping_info.get('shipping_cost')}, Zone: {shipping_info.get('zone')}")
        else:
            self.log_test("POST /api/shipping/calculate (Portugal)", False, f"Status: {response.status_code}")
        
        # Test Spain (Iberian zone - €6.99)
        spain_data = {"country": "spain", "zip_code": ""}
        success, response = self.test_api_endpoint('POST', 'shipping/calculate', 200, spain_data)
        if success:
            shipping_info = response.json()
            correct_cost = shipping_info.get('shipping_cost') == 6.99
            correct_zone = shipping_info.get('zone') == 'Iberian'
            self.log_test("POST /api/shipping/calculate (Spain)", 
                         correct_cost and correct_zone,
                         f"Cost: €{shipping_info.get('shipping_cost')}, Zone: {shipping_info.get('zone')}")
        else:
            self.log_test("POST /api/shipping/calculate (Spain)", False, f"Status: {response.status_code}")
        
        # Test France (Western EU zone - €9.99)
        france_data = {"country": "france", "zip_code": ""}
        success, response = self.test_api_endpoint('POST', 'shipping/calculate', 200, france_data)
        if success:
            shipping_info = response.json()
            correct_cost = shipping_info.get('shipping_cost') == 9.99
            correct_zone = shipping_info.get('zone') == 'Western EU'
            self.log_test("POST /api/shipping/calculate (France)", 
                         correct_cost and correct_zone,
                         f"Cost: €{shipping_info.get('shipping_cost')}, Zone: {shipping_info.get('zone')}")
        else:
            self.log_test("POST /api/shipping/calculate (France)", False, f"Status: {response.status_code}")
        
        # Test United Kingdom (UK zone - €14.99)
        uk_data = {"country": "united kingdom", "zip_code": ""}
        success, response = self.test_api_endpoint('POST', 'shipping/calculate', 200, uk_data)
        if success:
            shipping_info = response.json()
            correct_cost = shipping_info.get('shipping_cost') == 14.99
            correct_zone = shipping_info.get('zone') == 'UK'
            self.log_test("POST /api/shipping/calculate (United Kingdom)", 
                         correct_cost and correct_zone,
                         f"Cost: €{shipping_info.get('shipping_cost')}, Zone: {shipping_info.get('zone')}")
        else:
            self.log_test("POST /api/shipping/calculate (United Kingdom)", False, f"Status: {response.status_code}")
        
        # Test Non-European country (should return 400 error)
        us_data = {"country": "united states", "zip_code": "90210"}
        success, response = self.test_api_endpoint('POST', 'shipping/calculate', 400, us_data)
        if success:
            error_info = response.json()
            has_europe_error = 'Europe' in error_info.get('detail', '')
            self.log_test("POST /api/shipping/calculate (Non-European - US)", 
                         has_europe_error,
                         f"Error message: {error_info.get('detail', 'No detail')}")
        else:
            self.log_test("POST /api/shipping/calculate (Non-European - US)", False, 
                         f"Expected 400, got {response.status_code}")
        
        # Test another non-European country
        japan_data = {"country": "japan", "zip_code": ""}
        success, response = self.test_api_endpoint('POST', 'shipping/calculate', 400, japan_data)
        if success:
            error_info = response.json()
            has_europe_error = 'Europe' in error_info.get('detail', '')
            self.log_test("POST /api/shipping/calculate (Non-European - Japan)", 
                         has_europe_error,
                         f"Error message: {error_info.get('detail', 'No detail')}")
        else:
            self.log_test("POST /api/shipping/calculate (Non-European - Japan)", False, 
                         f"Expected 400, got {response.status_code}")

    def test_admin_api(self):
        """Test admin-only endpoints"""
        print("\n👑 Testing Admin APIs...")
        
        if not hasattr(self, 'admin_cookies'):
            print("⚠️ Skipping admin tests - no admin session")
            return

        # Test admin product creation
        new_product = {
            "name": "Test Product",
            "description": "A test product for API testing",
            "price": 29.99,
            "category": "Skincare",
            "image_url": "https://example.com/test.jpg",
            "stock": 50,
            "featured": False
        }
        success, response = self.test_api_endpoint('POST', 'admin/products', 200, new_product, cookies=self.admin_cookies)
        if success:
            created_product = response.json()
            self.test_product_id = created_product.get('id')
            self.log_test("POST /api/admin/products", True, f"Created product ID: {self.test_product_id}")
        else:
            self.log_test("POST /api/admin/products", False, f"Status: {response.status_code}")
            return

        # Test admin product update
        if hasattr(self, 'test_product_id'):
            update_data = {"price": 39.99, "stock": 75}
            success, response = self.test_api_endpoint('PUT', f'admin/products/{self.test_product_id}', 200, update_data, cookies=self.admin_cookies)
            self.log_test("PUT /api/admin/products/{id}", success)

            # Test admin product deletion
            success, response = self.test_api_endpoint('DELETE', f'admin/products/{self.test_product_id}', 200, cookies=self.admin_cookies)
            self.log_test("DELETE /api/admin/products/{id}", success)

        # Test admin orders endpoint
        success, response = self.test_api_endpoint('GET', 'admin/orders', 200, cookies=self.admin_cookies)
        if success:
            orders = response.json()
            self.log_test("GET /api/admin/orders", True, f"Found {len(orders)} orders")
        else:
            self.log_test("GET /api/admin/orders", False, f"Status: {response.status_code}")

    def test_currency_api(self):
        """Test currency exchange rates API"""
        print("\n💱 Testing Currency API...")
        
        # Test GET /api/currency/rates
        success, response = self.test_api_endpoint('GET', 'currency/rates', 200)
        if success:
            rates_data = response.json()
            has_base = rates_data.get('base') == 'EUR'
            has_rates = 'rates' in rates_data and isinstance(rates_data['rates'], dict)
            has_eur = rates_data.get('rates', {}).get('EUR') == 1.0
            has_usd = 'USD' in rates_data.get('rates', {})
            has_gbp = 'GBP' in rates_data.get('rates', {})
            
            all_checks = has_base and has_rates and has_eur and has_usd and has_gbp
            self.log_test("GET /api/currency/rates", all_checks, 
                         f"Base: {rates_data.get('base')}, Rates count: {len(rates_data.get('rates', {}))}")
        else:
            self.log_test("GET /api/currency/rates", False, f"Status: {response.status_code}")

    def test_admin_analytics_api(self):
        """Test admin analytics endpoint"""
        print("\n📊 Testing Admin Analytics API...")
        
        if not hasattr(self, 'admin_cookies'):
            print("⚠️ Skipping analytics tests - no admin session")
            return

        # Test GET /api/admin/analytics
        success, response = self.test_api_endpoint('GET', 'admin/analytics', 200, cookies=self.admin_cookies)
        if success:
            analytics = response.json()
            required_fields = ['total_products', 'total_stock', 'total_orders', 'total_revenue', 
                             'category_stock', 'category_revenue', 'low_stock_items']
            
            has_all_fields = all(field in analytics for field in required_fields)
            has_valid_totals = (isinstance(analytics.get('total_products'), int) and 
                              isinstance(analytics.get('total_stock'), int) and
                              isinstance(analytics.get('total_orders'), int) and
                              isinstance(analytics.get('total_revenue'), (int, float)))
            
            self.log_test("GET /api/admin/analytics", has_all_fields and has_valid_totals,
                         f"Products: {analytics.get('total_products')}, Stock: {analytics.get('total_stock')}")
        else:
            self.log_test("GET /api/admin/analytics", False, f"Status: {response.status_code}")

    def test_image_upload_api(self):
        """Test image upload endpoint"""
        print("\n🖼️ Testing Image Upload API...")
        
        if not hasattr(self, 'admin_cookies'):
            print("⚠️ Skipping image upload tests - no admin session")
            return

        # Create a simple test image (1x1 PNG)
        import base64
        # Minimal 1x1 PNG image in base64
        png_data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGfEUAAA==')
        
        # Test image upload
        files = {'file': ('test.png', png_data, 'image/png')}
        
        try:
            url = f"{self.api_url}/upload/image"
            response = requests.post(url, files=files, cookies=self.admin_cookies)
            
            success = response.status_code == 200
            if success:
                upload_data = response.json()
                has_path = 'path' in upload_data
                has_url = 'url' in upload_data
                self.log_test("POST /api/upload/image", has_path and has_url,
                             f"Upload path: {upload_data.get('path', 'N/A')}")
            else:
                self.log_test("POST /api/upload/image", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("POST /api/upload/image", False, f"Error: {str(e)}")

    def test_checkout_api(self):
        """Test checkout session creation"""
        print("\n💳 Testing Checkout API...")
        
        if not hasattr(self, 'products') or not self.products:
            print("⚠️ Skipping checkout tests - no products available")
            return

        # Test checkout session creation with European shipping
        checkout_data = {
            "items": [
                {
                    "product_id": self.products[0]['id'],
                    "quantity": 1
                }
            ],
            "shipping_address": {
                "full_name": "Test User",
                "address": "Rua de Teste 123",
                "city": "Sanguedo",
                "state": "",
                "zip_code": "4505-609",
                "country": "portugal"
            },
            "origin_url": self.base_url,
            "guest_email": "test@example.com"
        }
        
        success, response = self.test_api_endpoint('POST', 'checkout/session', 200, checkout_data)
        if success:
            session_data = response.json()
            has_url = 'url' in session_data
            has_session_id = 'session_id' in session_data
            self.log_test("POST /api/checkout/session", has_url and has_session_id, f"Session created: {session_data.get('session_id', 'N/A')}")
        else:
            self.log_test("POST /api/checkout/session", False, f"Status: {response.status_code}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🧪 Starting VivaLusa Backend API Tests...")
        print(f"🌐 Testing against: {self.base_url}")
        
        self.test_products_api()
        self.test_auth_api()
        self.test_shipping_api()
        self.test_currency_api()
        self.test_admin_api()
        self.test_admin_analytics_api()
        self.test_image_upload_api()
        self.test_checkout_api()
        
        # Print summary
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = VivaLusaAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())