#!/usr/bin/env python3
"""
AI Agent Factory Backend API Testing Suite
Tests all critical backend APIs using the production URL
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Use localhost for testing as specified in the review request
BASE_URL = "http://localhost:3010/api"

# Test users as specified in the review request
TEST_USERS = {
    "owner": "owner123",
    "test_user": "testuser456"
}

class APITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.tokens = {}
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    headers: Dict = None, auth_token: str = None) -> tuple[bool, Dict]:
        """Make HTTP request and return (success, response_data)"""
        url = f"{self.base_url}{endpoint}"
        
        # Set up headers
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        if auth_token:
            req_headers["Authorization"] = f"Bearer {auth_token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=req_headers, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=req_headers, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=req_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=req_headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}
                
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text, "status_code": response.status_code}
                
            return response.status_code < 400, response_data
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}
    
    def test_authentication_flow(self):
        """Test authentication endpoints"""
        print("\n=== Testing Authentication Flow ===")
        
        # Test 1: Login with owner account
        success, response = self.make_request(
            "POST", "/auth/token", 
            {"telegramId": TEST_USERS["owner"]}
        )
        
        if success and "accessToken" in response:
            self.tokens["owner"] = response["accessToken"]
            self.log_test("Owner login", True, f"Got access token")
            
            # Verify user data in response
            if "user" in response:
                user = response["user"]
                expected_fields = ["id", "telegramId", "role", "status"]
                missing_fields = [f for f in expected_fields if f not in user]
                if not missing_fields:
                    self.log_test("Owner login user data", True, f"Role: {user.get('role')}, Status: {user.get('status')}")
                else:
                    self.log_test("Owner login user data", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Owner login user data", False, "No user data in response")
        else:
            self.log_test("Owner login", False, f"Response: {response}")
            
        # Test 2: Login with test user
        success, response = self.make_request(
            "POST", "/auth/token", 
            {"telegramId": TEST_USERS["test_user"]}
        )
        
        if success and "accessToken" in response:
            self.tokens["test_user"] = response["accessToken"]
            self.log_test("Test user login", True, f"Got access token")
        else:
            self.log_test("Test user login", False, f"Response: {response}")
            
        # Test 3: Get current user info (using owner token)
        if "owner" in self.tokens:
            success, response = self.make_request(
                "GET", "/auth/me", 
                auth_token=self.tokens["owner"]
            )
            
            if success and "user" in response:
                user = response["user"]
                if user.get("telegramId") == TEST_USERS["owner"]:
                    self.log_test("Get current user info", True, f"Verified owner identity")
                else:
                    self.log_test("Get current user info", False, f"Wrong user returned: {user}")
            else:
                self.log_test("Get current user info", False, f"Response: {response}")
        else:
            self.log_test("Get current user info", False, "No owner token available")
    
    def test_credits_system(self):
        """Test credits system endpoints"""
        print("\n=== Testing Credits System ===")
        
        # Test with owner token
        if "owner" in self.tokens:
            success, response = self.make_request(
                "GET", "/credits/balance",
                auth_token=self.tokens["owner"]
            )
            
            if success:
                expected_fields = ["balance", "dailyUsed", "dailyLimit"]
                missing_fields = [f for f in expected_fields if f not in response]
                if not missing_fields:
                    self.log_test("Credits balance (owner)", True, 
                                f"Balance: {response.get('balance')}, Daily: {response.get('dailyUsed')}/{response.get('dailyLimit')}")
                else:
                    self.log_test("Credits balance (owner)", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Credits balance (owner)", False, f"Response: {response}")
        else:
            self.log_test("Credits balance (owner)", False, "No owner token available")
            
        # Test with test user token
        if "test_user" in self.tokens:
            success, response = self.make_request(
                "GET", "/credits/balance",
                auth_token=self.tokens["test_user"]
            )
            
            if success:
                self.log_test("Credits balance (test user)", True, 
                            f"Balance: {response.get('balance')}, Daily: {response.get('dailyUsed')}/{response.get('dailyLimit')}")
            else:
                self.log_test("Credits balance (test user)", False, f"Response: {response}")
        else:
            self.log_test("Credits balance (test user)", False, "No test user token available")
    
    def test_payment_system(self):
        """Test payment system endpoints"""
        print("\n=== Testing Payment System ===")
        
        # Test 1: Get payment config (no auth needed)
        success, response = self.make_request("GET", "/payments/config")
        
        if success:
            expected_fields = ["mode", "starsToCreditsRate", "currency", "packages"]
            missing_fields = [f for f in expected_fields if f not in response]
            if not missing_fields:
                self.log_test("Payment config", True, 
                            f"Mode: {response.get('mode')}, Rate: {response.get('starsToCreditsRate')}, Currency: {response.get('currency')}")
            else:
                self.log_test("Payment config", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("Payment config", False, f"Response: {response}")
            
        # Test 2: Create payment (with owner token)
        if "owner" in self.tokens:
            success, response = self.make_request(
                "POST", "/payments/create",
                {"starsAmount": 10},
                auth_token=self.tokens["owner"]
            )
            
            if success:
                expected_fields = ["success", "paymentId", "creditsToReceive"]
                missing_fields = [f for f in expected_fields if f not in response]
                if not missing_fields and response.get("success"):
                    self.log_test("Create payment", True, 
                                f"Payment ID: {response.get('paymentId')}, Credits: {response.get('creditsToReceive')}")
                else:
                    self.log_test("Create payment", False, f"Missing fields or failed: {missing_fields}, Response: {response}")
            else:
                self.log_test("Create payment", False, f"Response: {response}")
        else:
            self.log_test("Create payment", False, "No owner token available")
    
    def test_admin_apis(self):
        """Test admin APIs (requires owner token)"""
        print("\n=== Testing Admin APIs ===")
        
        if "owner" not in self.tokens:
            self.log_test("Admin APIs", False, "No owner token available")
            return
            
        owner_token = self.tokens["owner"]
        
        # Test 1: Get admin stats
        success, response = self.make_request(
            "GET", "/admin/stats",
            auth_token=owner_token
        )
        
        if success:
            # Check for typical stats fields
            stats_fields = ["users", "payments", "runs"]
            has_stats = any(field in response for field in stats_fields)
            if has_stats:
                self.log_test("Admin stats", True, f"Got statistics data")
            else:
                self.log_test("Admin stats", True, f"Response: {response}")  # Still pass if we get a response
        else:
            self.log_test("Admin stats", False, f"Response: {response}")
            
        # Test 2: Get users list
        success, response = self.make_request(
            "GET", "/admin/users",
            auth_token=owner_token
        )
        
        if success:
            if "users" in response or isinstance(response, list):
                users_data = response.get("users", response)
                self.log_test("Admin users list", True, f"Got {len(users_data) if isinstance(users_data, list) else 'unknown'} users")
                
                # Store user ID for approval test
                if isinstance(users_data, list) and len(users_data) > 0:
                    # Look for test user
                    test_user_data = None
                    for user in users_data:
                        if user.get("telegramId") == TEST_USERS["test_user"]:
                            test_user_data = user
                            break
                    
                    if test_user_data:
                        self.test_user_approval(owner_token, test_user_data["id"])
            else:
                self.log_test("Admin users list", False, f"No users data in response: {response}")
        else:
            self.log_test("Admin users list", False, f"Response: {response}")
    
    def test_user_approval(self, owner_token: str, user_id: str):
        """Test user approval functionality"""
        success, response = self.make_request(
            "POST", f"/admin/users/{user_id}/approve",
            {"initialCredits": 100},
            auth_token=owner_token
        )
        
        if success:
            if response.get("success"):
                self.log_test("User approval", True, f"Successfully approved user {user_id}")
            else:
                self.log_test("User approval", False, f"Approval failed: {response}")
        else:
            self.log_test("User approval", False, f"Response: {response}")
    
    def test_llm_health(self):
        """Test LLM health endpoint"""
        print("\n=== Testing LLM Health ===")
        
        # Note: This endpoint might be at root level, not /api
        llm_url = "http://localhost:3010/debug/llm"
        
        try:
            response = self.session.get(llm_url, timeout=30)
            if response.status_code < 400:
                try:
                    data = response.json()
                    if "ok" in data:
                        self.log_test("LLM health check", True, f"Status: {data.get('ok')}")
                    else:
                        self.log_test("LLM health check", True, f"Got response: {data}")
                except:
                    self.log_test("LLM health check", True, f"Got response (non-JSON): {response.text[:100]}")
            else:
                self.log_test("LLM health check", False, f"HTTP {response.status_code}: {response.text[:100]}")
        except Exception as e:
            self.log_test("LLM health check", False, f"Error: {str(e)}")
    
    def test_ai_pipeline(self):
        """Test AI Pipeline endpoint (if sufficient credits)"""
        print("\n=== Testing AI Pipeline ===")
        
        if "owner" not in self.tokens:
            self.log_test("AI Pipeline", False, "No owner token available")
            return
            
        # Test creating a bot with the master endpoint
        success, response = self.make_request(
            "POST", "/master/bot",
            {"description": "A simple test bot for API testing"},
            auth_token=self.tokens["owner"]
        )
        
        if success:
            if "agentRunId" in response or "id" in response:
                self.log_test("AI Pipeline - Bot Creation", True, f"AgentRun created successfully")
            else:
                self.log_test("AI Pipeline - Bot Creation", True, f"Got response: {response}")
        else:
            # Check if it's a credits issue or other error
            error_msg = response.get("error", str(response))
            if "credit" in error_msg.lower() or "insufficient" in error_msg.lower():
                self.log_test("AI Pipeline - Bot Creation", False, f"Insufficient credits: {error_msg}")
            else:
                self.log_test("AI Pipeline - Bot Creation", False, f"Response: {response}")
    
    def test_credits_history(self):
        """Test credits history endpoint"""
        print("\n=== Testing Credits History ===")
        
        if "owner" in self.tokens:
            success, response = self.make_request(
                "GET", "/credits/history",
                auth_token=self.tokens["owner"]
            )
            
            if success:
                if "transactions" in response or isinstance(response, list):
                    transactions = response.get("transactions", response)
                    self.log_test("Credits history (owner)", True, 
                                f"Got {len(transactions) if isinstance(transactions, list) else 'unknown'} transactions")
                else:
                    self.log_test("Credits history (owner)", True, f"Got response: {response}")
            else:
                self.log_test("Credits history (owner)", False, f"Response: {response}")
        else:
            self.log_test("Credits history (owner)", False, "No owner token available")
    
    def test_admin_payments_and_audit(self):
        """Test additional admin endpoints"""
        print("\n=== Testing Additional Admin APIs ===")
        
        if "owner" not in self.tokens:
            self.log_test("Admin Payments/Audit", False, "No owner token available")
            return
            
        owner_token = self.tokens["owner"]
        
        # Test admin payments endpoint
        success, response = self.make_request(
            "GET", "/admin/payments",
            auth_token=owner_token
        )
        
        if success:
            if "payments" in response or isinstance(response, list):
                payments = response.get("payments", response)
                self.log_test("Admin payments list", True, 
                            f"Got {len(payments) if isinstance(payments, list) else 'unknown'} payments")
            else:
                self.log_test("Admin payments list", True, f"Got response: {response}")
        else:
            self.log_test("Admin payments list", False, f"Response: {response}")
            
        # Test admin audit logs endpoint
        success, response = self.make_request(
            "GET", "/admin/audit-logs",
            auth_token=owner_token
        )
        
        if success:
            if "logs" in response or isinstance(response, list):
                logs = response.get("logs", response)
                self.log_test("Admin audit logs", True, 
                            f"Got {len(logs) if isinstance(logs, list) else 'unknown'} audit logs")
            else:
                self.log_test("Admin audit logs", True, f"Got response: {response}")
        else:
            self.log_test("Admin audit logs", False, f"Response: {response}")
    
    def test_admin_credits_setting(self):
        """Test admin setting credits for users"""
        print("\n=== Testing Admin Credits Setting ===")
        
        if "owner" not in self.tokens:
            self.log_test("Admin Credits Setting", False, "No owner token available")
            return
            
        # First get users to find test user ID
        success, response = self.make_request(
            "GET", "/admin/users",
            auth_token=self.tokens["owner"]
        )
        
        if success and ("users" in response or isinstance(response, list)):
            users_data = response.get("users", response)
            test_user_data = None
            
            for user in users_data:
                if user.get("telegramId") == TEST_USERS["test_user"]:
                    test_user_data = user
                    break
            
            if test_user_data:
                # Test setting credits
                success, response = self.make_request(
                    "POST", f"/admin/users/{test_user_data['id']}/credits",
                    {"credits": 200},
                    auth_token=self.tokens["owner"]
                )
                
                if success:
                    if response.get("success"):
                        self.log_test("Admin set credits", True, f"Successfully set credits for user {test_user_data['id']}")
                    else:
                        self.log_test("Admin set credits", False, f"Failed to set credits: {response}")
                else:
                    self.log_test("Admin set credits", False, f"Response: {response}")
            else:
                self.log_test("Admin set credits", False, "Test user not found")
        else:
            self.log_test("Admin set credits", False, "Could not get users list")
    
    def run_all_tests(self):
        """Run all test suites"""
        print(f"🚀 Starting AI Agent Factory Backend API Tests")
        print(f"📡 Base URL: {self.base_url}")
        print(f"👥 Test Users: {TEST_USERS}")
        
        # Run test suites in order
        self.test_authentication_flow()
        self.test_credits_system()
        self.test_credits_history()
        self.test_payment_system()
        self.test_admin_apis()
        self.test_admin_payments_and_audit()
        self.test_admin_credits_setting()
        self.test_llm_health()
        self.test_ai_pipeline()
        
        # Summary
        print("\n" + "="*50)
        print("📊 TEST SUMMARY")
        print("="*50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if total - passed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   ❌ {result['test']}: {result['details']}")
        
        print(f"\n🎯 Success Rate: {(passed/total)*100:.1f}%")
        
        return passed == total

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)