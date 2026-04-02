#!/usr/bin/env python3
"""
Backend API Testing for iOS SignTool
Tests all API endpoints with proper error handling and validation
"""

import requests
import sys
import json
import tempfile
import os
from datetime import datetime

# Use the public backend URL from frontend .env
BACKEND_URL = "https://apple-cert-tool.preview.emergentagent.com"

class IOSSignToolTester:
    def __init__(self, base_url=BACKEND_URL):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'iOS-SignTool-Tester/1.0'
        })

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        if details and success:
            print(f"   {details}")

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                details = f"Status: {data.get('status')}, Active jobs: {data.get('active_jobs', 0)}"
                self.log_test("Health endpoint", True, details)
                return True
            else:
                self.log_test("Health endpoint", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Health endpoint", False, f"Error: {str(e)}")
            return False

    def test_app_library_endpoint(self):
        """Test /api/apps endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/apps", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                apps = data.get('apps', [])
                details = f"Found {len(apps)} apps in library"
                self.log_test("App library endpoint", True, details)
                return True
            else:
                self.log_test("App library endpoint", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("App library endpoint", False, f"Error: {str(e)}")
            return False

    def create_dummy_p12_file(self):
        """Create a dummy P12 file for testing"""
        # This is a minimal dummy file - real testing would need actual P12 files
        dummy_content = b"dummy_p12_content_for_testing"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.p12')
        temp_file.write(dummy_content)
        temp_file.close()
        return temp_file.name

    def create_dummy_mobileprovision_file(self):
        """Create a dummy mobileprovision file for testing"""
        # This is a minimal dummy file - real testing would need actual mobileprovision files
        dummy_content = b"dummy_mobileprovision_content_for_testing"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mobileprovision')
        temp_file.write(dummy_content)
        temp_file.close()
        return temp_file.name

    def test_check_cert_no_files(self):
        """Test /api/check-cert endpoint without files (should fail)"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/check-cert",
                data={'password': 'test'},
                timeout=10
            )
            
            # Should fail with 422 (missing files) or 400
            if response.status_code in [400, 422]:
                self.log_test("Check cert without files", True, f"Correctly rejected with HTTP {response.status_code}")
                return True
            else:
                self.log_test("Check cert without files", False, f"Unexpected HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Check cert without files", False, f"Error: {str(e)}")
            return False

    def test_check_cert_with_dummy_files(self):
        """Test /api/check-cert endpoint with dummy files (should fail gracefully)"""
        p12_file = None
        mp_file = None
        
        try:
            p12_file = self.create_dummy_p12_file()
            mp_file = self.create_dummy_mobileprovision_file()
            
            with open(p12_file, 'rb') as p12, open(mp_file, 'rb') as mp:
                files = {
                    'p12_file': ('test.p12', p12, 'application/octet-stream'),
                    'mobileprovision_file': ('test.mobileprovision', mp, 'application/octet-stream')
                }
                data = {'password': 'wrongpassword'}
                
                response = self.session.post(
                    f"{self.base_url}/api/check-cert",
                    files=files,
                    data=data,
                    timeout=10
                )
            
            # Should fail with 400 or 401 (invalid files or wrong password)
            if response.status_code in [400, 401]:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', 'Unknown error')
                    self.log_test("Check cert with dummy files", True, f"Correctly rejected: {error_msg}")
                except:
                    self.log_test("Check cert with dummy files", True, f"Correctly rejected with HTTP {response.status_code}")
                return True
            else:
                self.log_test("Check cert with dummy files", False, f"Unexpected HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Check cert with dummy files", False, f"Error: {str(e)}")
            return False
        finally:
            # Cleanup temp files
            for temp_file in [p12_file, mp_file]:
                if temp_file and os.path.exists(temp_file):
                    try:
                        os.unlink(temp_file)
                    except:
                        pass

    def test_change_cert_password_no_files(self):
        """Test /api/change-cert-password endpoint without files (should fail)"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/change-cert-password",
                data={
                    'old_password': 'old',
                    'new_password': 'new'
                },
                timeout=10
            )
            
            # Should fail with 400 or 422 (missing files)
            if response.status_code in [400, 422]:
                self.log_test("Change cert password without files", True, f"Correctly rejected with HTTP {response.status_code}")
                return True
            else:
                self.log_test("Change cert password without files", False, f"Unexpected HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Change cert password without files", False, f"Error: {str(e)}")
            return False

    def test_change_cert_password_with_dummy_files(self):
        """Test /api/change-cert-password endpoint with dummy files (should return 401 for wrong password)"""
        p12_file = None
        mp_file = None
        
        try:
            p12_file = self.create_dummy_p12_file()
            mp_file = self.create_dummy_mobileprovision_file()
            
            with open(p12_file, 'rb') as p12, open(mp_file, 'rb') as mp:
                files = {
                    'p12_file': ('test.p12', p12, 'application/octet-stream'),
                    'mobileprovision_file': ('test.mobileprovision', mp, 'application/octet-stream')
                }
                data = {
                    'old_password': 'wrongoldpassword',
                    'new_password': 'newpassword'
                }
                
                response = self.session.post(
                    f"{self.base_url}/api/change-cert-password",
                    files=files,
                    data=data,
                    timeout=10
                )
            
            # Should fail with 400 or 401 (invalid files or wrong password)
            if response.status_code in [400, 401]:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', 'Unknown error')
                    self.log_test("Change cert password with dummy files", True, f"Correctly rejected: {error_msg}")
                except:
                    self.log_test("Change cert password with dummy files", True, f"Correctly rejected with HTTP {response.status_code}")
                return True
            else:
                self.log_test("Change cert password with dummy files", False, f"Unexpected HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Change cert password with dummy files", False, f"Error: {str(e)}")
            return False
        finally:
            # Cleanup temp files
            for temp_file in [p12_file, mp_file]:
                if temp_file and os.path.exists(temp_file):
                    try:
                        os.unlink(temp_file)
                    except:
                        pass

    def run_all_tests(self):
        """Run all backend API tests"""
        print(f"🧪 Testing iOS SignTool Backend APIs")
        print(f"📡 Backend URL: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 60)
        
        # Test basic endpoints
        self.test_health_endpoint()
        self.test_app_library_endpoint()
        
        # Test check-cert endpoint
        self.test_check_cert_no_files()
        self.test_check_cert_with_dummy_files()
        
        # Test change-cert-password endpoint
        self.test_change_cert_password_no_files()
        self.test_change_cert_password_with_dummy_files()
        
        print("-" * 60)
        print(f"📊 Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend API tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} test(s) failed")
            return False

def main():
    """Main test runner"""
    tester = IOSSignToolTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())