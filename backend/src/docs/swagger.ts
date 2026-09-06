import type { Request, Response } from 'express';

export const openApiSpec: Record<string, unknown> = {
  openapi: '3.0.3',
  info: {
    title: 'Restaurant SaaS Platform API',
    version: '2.3.0',
    description:
      'Comprehensive enterprise REST API specification for the Restaurant SaaS Platform. Fully modeled for Apidog, Postman, and Swagger UI import.',
    contact: {
      name: 'Platform Engineering Team',
      email: 'support@restaurant-saas.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server',
    },
    {
      url: 'https://api.restaurantsaas.com',
      description: 'Production Serverless Cloud Gateway',
    },
  ],
  tags: [
    { name: 'System & Health Probes', description: 'Uptime, readiness, liveness, and AI diagnostic telemetry' },
    { name: 'Authentication', description: 'User onboarding, JWT token lifecycle, staff invitation, and OTP recovery' },
    { name: 'Tenants & Profiles', description: 'Tenant provisioning, restaurant dining profile, and kitchen operational flags' },
    { name: 'Subscriptions', description: 'SaaS tier management, plan limits, and subscription renewal cycles' },
    { name: 'Billing', description: 'Invoice records, transaction audits, and payment tracking' },
    { name: 'Branches', description: 'Multi-location branch management with zero-bleed isolation' },
    { name: 'Categories', description: 'Menu category organization with ordering and active toggles' },
    { name: 'Variants', description: 'Customizable dish option groups, price deltas, and select limits' },
    { name: 'Menu & Products', description: 'Single-product CRUD, bulk import, unified document upload, and RAG catalog' },
    { name: 'Tables & QR Codes', description: 'Dining tables, signed JWT QR codes, session tokens, and PNG generators' },
    { name: 'Chat Sessions & AI', description: 'Customer conversational sessions, channel resolution, and table binding' },
    { name: 'Vector Search', description: 'Gemini-powered semantic dish recommendations and vector embeddings' },
    { name: 'Orders & POS', description: 'Dine-in, takeaway, delivery, public QR ordering, offline sync, and KDS lifecycle' },
    { name: 'Coupons', description: 'Promotional discount codes, percentage/fixed savings, and validity verification' },
    { name: 'Customers', description: 'Diner directory, loyalty profiles, and contact registries' },
    { name: 'Employees', description: 'Branch staff roster, hourly wages, and shift management' },
    { name: 'Feedback', description: 'Guest dining experience ratings (1-5 stars) and customer sentiment' },
    { name: 'Reports & Analytics', description: 'Aggregated revenue analytics, daily sales, and table turnover insights' },
    { name: 'Notifications', description: 'Persistent audit trail and multi-channel dispatch (Email, Telegram)' },
    { name: 'Reservations', description: 'Table booking system for chatbot webhooks and staff floor management' },
    { name: 'QStash Background Jobs', description: 'Secured serverless webhook callbacks orchestrated via Upstash QStash' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Standard JWT Bearer token issued by /api/v1/auth/login or register endpoints',
      },
      TenantHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Tenant-Id',
        description: '24-hex Tenant Object ID for tenant-scoped operations',
      },
      QStashSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'upstash-signature',
        description: 'Cryptographic HMAC signature from Upstash QStash webhook dispatcher',
      },
    },
    schemas: {
      StandardSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' },
        },
      },
      StandardErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Resource not found or out of scope' },
        },
      },
      RegisterSuperAdminDto: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'superadmin@platform.com' },
          password: { type: 'string', minLength: 8, example: 'SuperAdminPassword2026!' },
          phone: { type: 'string', example: '+201000000001' },
        },
      },
      RegisterOwnerDto: {
        type: 'object',
        required: ['tenantId', 'email', 'password'],
        properties: {
          tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
          email: { type: 'string', format: 'email', example: 'owner@gourmetburger.com' },
          password: { type: 'string', minLength: 8, example: 'SecurePassword123!' },
          phone: { type: 'string', example: '+201012345678' },
        },
      },
      RegisterStaffDto: {
        type: 'object',
        required: ['email', 'password', 'role'],
        properties: {
          tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
          email: { type: 'string', format: 'email', example: 'cashier@gourmetburger.com' },
          password: { type: 'string', minLength: 8, example: 'CashierPass123!' },
          phone: { type: 'string', example: '+201087654321' },
          role: { type: 'string', enum: ['manager', 'cashier', 'kitchen'], example: 'cashier' },
        },
      },
      LoginDto: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'owner@gourmetburger.com' },
          password: { type: 'string', example: 'SecurePassword123!' },
          tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
          tenantSlug: { type: 'string', example: 'gourmet-burger' },
        },
      },
      RefreshTokenDto: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
      },
      ForgotPasswordDto: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'owner@gourmetburger.com' },
          tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
          tenantSlug: { type: 'string', example: 'gourmet-burger' },
        },
      },
      VerifyOtpDto: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: { type: 'string', format: 'email', example: 'owner@gourmetburger.com' },
          otp: { type: 'string', minLength: 6, maxLength: 6, example: '123456' },
          tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
          tenantSlug: { type: 'string', example: 'gourmet-burger' },
        },
      },
      ResetPasswordDto: {
        type: 'object',
        required: ['resetToken', 'newPassword'],
        properties: {
          resetToken: { type: 'string', example: 'reset-token-uuid-or-jwt' },
          newPassword: { type: 'string', minLength: 8, example: 'BrandNewSecurePassword2026!' },
        },
      },
      ChangePasswordDto: {
        type: 'object',
        required: ['oldPassword', 'newPassword'],
        properties: {
          oldPassword: { type: 'string', example: 'SecurePassword123!' },
          newPassword: { type: 'string', minLength: 8, example: 'BrandNewSecurePassword2026!' },
        },
      },
      CreateTenantDto: {
        type: 'object',
        required: ['name', 'slug', 'contact'],
        properties: {
          name: { type: 'string', example: 'Gourmet Burger House' },
          slug: { type: 'string', example: 'gourmet-burger' },
          contact: {
            type: 'object',
            required: ['phone', 'email'],
            properties: {
              phone: { type: 'string', example: '+201001234567' },
              email: { type: 'string', format: 'email', example: 'info@gourmetburger.com' },
            },
          },
          settings: {
            type: 'object',
            properties: {
              currency: { type: 'string', example: 'EGP' },
              timezone: { type: 'string', example: 'Africa/Cairo' },
              language: { type: 'string', enum: ['ar', 'en'], example: 'ar' },
            },
          },
        },
      },
      UpdateRestaurantProfileDto: {
        type: 'object',
        properties: {
          brandName: { type: 'string', example: 'Gourmet Burger House' },
          cuisineType: { type: 'string', example: 'American Fast Casual' },
          description: { type: 'string', example: 'Premium smashed burgers and gourmet sides.' },
          logoUrl: { type: 'string', format: 'uri', example: 'https://res.cloudinary.com/demo/logo.png' },
          currency: { type: 'string', example: 'EGP' },
          qrRedirectUrl: { type: 'string', format: 'uri', example: 'https://t.me/GourmetBurgerBot' },
          isOpen: { type: 'boolean', example: true },
          isChatbotActive: { type: 'boolean', example: true },
          chatbotSettings: {
            type: 'object',
            properties: {
              offlineMessage: { type: 'string', example: 'Kitchen closed! Operating hours are 11 AM - 2 AM.' },
              aiModelPreference: { type: 'string', example: 'gpt-4o' },
            },
          },
        },
      },
      CreateBranchDto: {
        type: 'object',
        required: ['name', 'slug', 'address', 'phone'],
        properties: {
          name: { type: 'string', example: 'Zamalek Branch' },
          slug: { type: 'string', example: 'zamalek' },
          address: { type: 'string', example: '26 July St, Zamalek, Cairo' },
          phone: { type: 'string', example: '+201011223344' },
          isActive: { type: 'boolean', example: true },
          tableCount: { type: 'integer', example: 12 },
        },
      },
      CreateCategoryDto: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Burgers' },
          displayOrder: { type: 'integer', example: 1 },
          isActive: { type: 'boolean', example: true },
        },
      },
      CreateVariantDto: {
        type: 'object',
        required: ['name', 'options'],
        properties: {
          name: { type: 'string', example: 'Cheese Selection' },
          minSelect: { type: 'integer', example: 0 },
          maxSelect: { type: 'integer', example: 2 },
          options: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', example: 'Cheddar' },
                priceDelta: { type: 'number', example: 15 },
                isDefault: { type: 'boolean', example: false },
              },
            },
          },
        },
      },
      CreateProductDto: {
        type: 'object',
        required: ['name', 'basePrice'],
        properties: {
          name: { type: 'string', example: 'Truffle Smash Burger' },
          description: { type: 'string', example: 'Double smashed beef patties, black truffle mayo, swiss cheese.' },
          basePrice: { type: 'number', example: 240 },
          imageUrl: { type: 'string', format: 'uri', example: 'https://res.cloudinary.com/demo/burger.jpg' },
          categoryId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c3' },
        },
      },
      CreateTableDto: {
        type: 'object',
        required: ['number'],
        properties: {
          branchId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c4' },
          number: { type: 'integer', example: 7 },
          capacity: { type: 'integer', example: 4 },
          status: { type: 'string', enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED'], example: 'AVAILABLE' },
        },
      },
      CreateCustomerOrderDto: {
        type: 'object',
        required: ['channel', 'customerName', 'customerPhone', 'items'],
        properties: {
          branchId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c4' },
          channel: { type: 'string', enum: ['TAKEAWAY', 'DELIVERY'], example: 'DELIVERY' },
          customerName: { type: 'string', example: 'Ahmed Hassan' },
          customerPhone: { type: 'string', example: '+201012345678' },
          customerEmail: { type: 'string', format: 'email', example: 'ahmed@gmail.com' },
          deliveryAddress: { type: 'string', example: 'Building 14, Rd 9, Maadi, Cairo' },
          couponCode: { type: 'string', example: 'WELCOME10' },
          notes: { type: 'string', example: 'Please ring bell upon arrival' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c1' },
                quantity: { type: 'integer', example: 2 },
                variantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c2' },
                selectedOptionNames: { type: 'array', items: { type: 'string' }, example: ['Extra Pickles'] },
                notes: { type: 'string', example: 'Well done' },
              },
            },
          },
        },
      },
      CreatePublicQrOrderDto: {
        type: 'object',
        required: ['tenantId', 'branchId', 'tableId', 'tableSessionId', 'items'],
        properties: {
          tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
          branchId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c4' },
          tableId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c0' },
          tableSessionId: { type: 'string', format: 'uuid', example: '49c95d90-67df-4cf6-932d-209fe571ce16' },
          tableNumber: { type: 'integer', example: 7 },
          customerName: { type: 'string', example: 'Dine-in Customer' },
          couponCode: { type: 'string', example: 'DINE10' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c1' },
                quantity: { type: 'integer', example: 1 },
                selectedOptionNames: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      CreateReservationDto: {
        type: 'object',
        required: ['tenantId', 'branchId', 'customerName', 'customerPhone', 'partySize', 'reservedFor'],
        properties: {
          tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
          branchId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c4' },
          tableId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c0' },
          customerName: { type: 'string', example: 'Laila Mostafa' },
          customerPhone: { type: 'string', example: '+201099887766' },
          partySize: { type: 'integer', example: 4 },
          reservedFor: { type: 'string', format: 'date-time', example: '2026-10-15T19:30:00.000Z' },
          channel: { type: 'string', enum: ['TELEGRAM', 'WEB', 'WHATSAPP', 'DASHBOARD'], example: 'TELEGRAM' },
          notes: { type: 'string', example: 'Corner booth requested' },
        },
      },
      CreateCouponDto: {
        type: 'object',
        required: ['code', 'expiresAt'],
        properties: {
          code: { type: 'string', example: 'SUMMER20' },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'], example: 'PERCENTAGE' },
          discountValue: { type: 'number', example: 20 },
          discountPercentage: { type: 'integer', example: 20 },
          minOrderAmount: { type: 'number', example: 100 },
          maxDiscountCap: { type: 'number', example: 50 },
          usageLimit: { type: 'integer', example: 500 },
          expiresAt: { type: 'string', format: 'date-time', example: '2026-12-31T23:59:59.000Z' },
          isActive: { type: 'boolean', example: true },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        tags: ['System & Health Probes'],
        summary: 'Root Welcome & System Info',
        description: 'Returns API version, environment, and online status.',
        responses: {
          '200': {
            description: 'Operational status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardSuccessResponse' } } },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System & Health Probes'],
        summary: 'Readiness Health Check',
        description: 'Quick check verifying that application is operational.',
        responses: { '200': { description: 'Healthy' }, '503': { description: 'Unhealthy' } },
      },
    },
    '/live': {
      get: {
        tags: ['System & Health Probes'],
        summary: 'Liveness Probe',
        description: 'Kubernetes/Docker liveness probe alias.',
        responses: { '200': { description: 'Live' } },
      },
    },
    '/ready': {
      get: {
        tags: ['System & Health Probes'],
        summary: 'Full Infrastructure Readiness Probe',
        description: 'Inspects active connections to MongoDB Atlas, Upstash Redis, QStash, and Firebase Admin SDK.',
        responses: { '200': { description: 'All systems operational' }, '503': { description: 'Degraded dependency' } },
      },
    },
    '/health/ai': {
      get: {
        tags: ['System & Health Probes'],
        summary: 'AI & Vector Diagnostic Check',
        description: 'Verifies Gemini text generation, vector embeddings, and Upstash Vector index connectivity.',
        responses: { '200': { description: 'AI infrastructure healthy' }, '500': { description: 'AI diagnostic failed' } },
      },
    },

    // ─── AUTHENTICATION ────────────────────────────────────────────────────────
    '/api/v1/auth/register/super-admin': {
      post: {
        tags: ['Authentication'],
        summary: 'Register Platform Super Admin',
        description: 'Provisions the root platform super administrator account.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterSuperAdminDto' } } },
        },
        responses: { '201': { description: 'Super admin created successfully' } },
      },
    },
    '/api/v1/auth/register/owner': {
      post: {
        tags: ['Authentication'],
        summary: 'Register Restaurant Owner',
        security: [{ BearerAuth: [] }],
        description: 'Provisions the primary owner user account for a client restaurant tenant (super_admin required).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterOwnerDto' } } },
        },
        responses: { '201': { description: 'Owner created' }, '403': { description: 'Forbidden' } },
      },
    },
    '/api/v1/auth/register/staff': {
      post: {
        tags: ['Authentication'],
        summary: 'Register Staff Member',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Invites staff member (manager, cashier, kitchen) into current tenant (owner/manager required).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterStaffDto' } } },
        },
        responses: { '201': { description: 'Staff member created' } },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User Login',
        description: 'Authenticates with email and password, returning JWT access and refresh tokens.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginDto' } } },
        },
        responses: { '200': { description: 'Authenticated successfully' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh Access Token',
        description: 'Rotates refresh token and issues a fresh short-lived JWT access token.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenDto' } } },
        },
        responses: { '200': { description: 'Tokens rotated' }, '401': { description: 'Invalid or expired token' } },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Forgot Password OTP Request',
        description: 'Sends a 6-digit OTP verification code to the registered email address.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordDto' } } },
        },
        responses: { '200': { description: 'OTP dispatched' } },
      },
    },
    '/api/v1/auth/verify-otp': {
      post: {
        tags: ['Authentication'],
        summary: 'Verify OTP Code',
        description: 'Validates the 6-digit OTP code and issues a 15-minute password reset token.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyOtpDto' } } },
        },
        responses: { '200': { description: 'OTP verified' }, '400': { description: 'Invalid or expired OTP' } },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Reset Password',
        description: 'Sets a new password using the validated reset token.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordDto' } } },
        },
        responses: { '200': { description: 'Password reset successfully' } },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout User',
        security: [{ BearerAuth: [] }],
        description: 'Revokes active refresh token and invalidates the session.',
        responses: { '200': { description: 'Logged out' } },
      },
    },
    '/api/v1/auth/change-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Change Password',
        security: [{ BearerAuth: [] }],
        description: 'Changes password for currently authenticated user.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordDto' } } },
        },
        responses: { '200': { description: 'Password changed successfully' } },
      },
    },

    // ─── TENANTS & PROFILES ────────────────────────────────────────────────────
    '/api/v1/tenants': {
      post: {
        tags: ['Tenants & Profiles'],
        summary: 'Create Tenant Workspace',
        security: [{ BearerAuth: [] }],
        description: 'Creates a new restaurant tenant workspace with auto-provisioned default branch (super_admin required).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTenantDto' } } },
        },
        responses: { '201': { description: 'Tenant provisioned' }, '409': { description: 'Slug already taken' } },
      },
    },
    '/api/v1/tenants/{tenantId}/ai-status': {
      get: {
        tags: ['Tenants & Profiles'],
        summary: 'Public AI & Kitchen Status Gateway',
        description: 'Public endpoint used by n8n Cloud and chatbots to check if kitchen is open and chatbot is active.',
        parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Status details' } },
      },
    },
    '/api/v1/tenants/{tenantId}/branches/{branchId}/info': {
      get: {
        tags: ['Tenants & Profiles'],
        summary: 'Public Tenant & Branch Summary Info',
        description: 'Unprotected public endpoint returning small info (brand name, cuisine, contacts, branch address, status).',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'branchId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Tenant & Branch details' }, '404': { description: 'Not found' } },
      },
    },
    '/api/v1/tenants/{tenantId}/branches/{branchId}': {
      get: {
        tags: ['Tenants & Profiles'],
        summary: 'Public Tenant & Branch Summary Info (Alias)',
        description: 'Alias route returning small info about a tenant and branch without requiring authentication.',
        parameters: [
          { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'branchId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Tenant & Branch details' }, '404': { description: 'Not found' } },
      },
    },
    '/api/v1/tenants/profile': {
      get: {
        tags: ['Tenants & Profiles'],
        summary: 'Get Restaurant Profile',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Retrieves public dining restaurant profile, chatbot settings, and operational flags.',
        responses: { '200': { description: 'Profile found' } },
      },
      put: {
        tags: ['Tenants & Profiles'],
        summary: 'Update Restaurant Profile',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Updates brand name, cuisine type, logo, telegram redirect URL, kitchen status, etc.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateRestaurantProfileDto' } } },
        },
        responses: { '200': { description: 'Profile updated' } },
      },
      post: {
        tags: ['Tenants & Profiles'],
        summary: 'Upsert Restaurant Profile',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Upserts restaurant profile data.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateRestaurantProfileDto' } } },
        },
        responses: { '200': { description: 'Profile updated' } },
      },
    },
    '/api/v1/tenants/me': {
      get: {
        tags: ['Tenants & Profiles'],
        summary: 'Get Current Tenant Workspace Details',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Tenant details' } },
      },
    },
    '/api/v1/tenants/{id}': {
      get: {
        tags: ['Tenants & Profiles'],
        summary: 'Get Tenant by ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Tenant found' }, '403': { description: 'Cross-tenant access forbidden' } },
      },
    },
    '/api/v1/tenants/settings': {
      patch: {
        tags: ['Tenants & Profiles'],
        summary: 'Update Tenant Settings',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Updates currency, timezone, and language preferences (owner required).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  settings: {
                    type: 'object',
                    properties: {
                      currency: { type: 'string' },
                      timezone: { type: 'string' },
                      language: { type: 'string', enum: ['ar', 'en'] },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Settings updated' } },
      },
    },

    // ─── SUBSCRIPTIONS & BILLING ───────────────────────────────────────────────
    '/api/v1/subscriptions': {
      get: {
        tags: ['Subscriptions'],
        summary: 'Get Active Subscription',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Returns the active subscription plan and renewal expiry for the tenant workspace.',
        responses: { '200': { description: 'Subscription details' } },
      },
      patch: {
        tags: ['Subscriptions'],
        summary: 'Update Subscription Plan',
        security: [{ BearerAuth: [] }],
        description: 'Upgrades or modifies subscription tier for target tenant (super_admin required; tenantId in body).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tenantId', 'plan'],
                properties: {
                  tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
                  plan: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'], example: 'pro' },
                  status: { type: 'string', enum: ['active', 'trialing', 'past_due', 'canceled', 'expired'], example: 'active' },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Subscription updated' } },
      },
    },
    '/api/v1/billing': {
      get: {
        tags: ['Billing'],
        summary: 'List Billing Invoices',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Billing history records' } },
      },
      post: {
        tags: ['Billing'],
        summary: 'Create Billing Invoice Record',
        security: [{ BearerAuth: [] }],
        description: 'Records an invoice or transaction for a tenant (super_admin required; tenantId in body).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tenantId', 'amount'],
                properties: {
                  tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
                  amount: { type: 'number', example: 1499 },
                  currency: { type: 'string', example: 'EGP' },
                  status: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'], example: 'paid' },
                  provider: { type: 'string', example: 'Fawry' },
                  providerRef: { type: 'string', example: 'FAW-998822' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Billing record created' } },
      },
    },
    '/api/v1/billing/{id}': {
      get: {
        tags: ['Billing'],
        summary: 'Get Specific Billing Record',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Record details' } },
      },
    },

    // ─── BRANCHES ──────────────────────────────────────────────────────────────
    '/api/v1/branches': {
      post: {
        tags: ['Branches'],
        summary: 'Create Branch',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateBranchDto' } } },
        },
        responses: { '201': { description: 'Branch created' } },
      },
      get: {
        tags: ['Branches'],
        summary: 'List Branches',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Branch array' } },
      },
    },
    '/api/v1/branches/{id}': {
      get: {
        tags: ['Branches'],
        summary: 'Get Branch by ID',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Branch details' } },
      },
      put: {
        tags: ['Branches'],
        summary: 'Update Branch',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateBranchDto' } } },
        },
        responses: { '200': { description: 'Branch updated' } },
      },
      delete: {
        tags: ['Branches'],
        summary: 'Delete Branch',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Branch deleted' } },
      },
    },

    // ─── CATEGORIES & VARIANTS ────────────────────────────────────────────────
    '/api/v1/categories': {
      post: {
        tags: ['Categories'],
        summary: 'Create Category',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCategoryDto' } } },
        },
        responses: { '201': { description: 'Category created' } },
      },
      get: {
        tags: ['Categories'],
        summary: 'List Categories',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Categories list' } },
      },
    },
    '/api/v1/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Get Category',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Category details' } },
      },
      put: {
        tags: ['Categories'],
        summary: 'Update Category',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCategoryDto' } } },
        },
        responses: { '200': { description: 'Category updated' } },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete Category',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Category deleted' } },
      },
    },
    '/api/v1/variants': {
      post: {
        tags: ['Variants'],
        summary: 'Create Variant Group',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVariantDto' } } },
        },
        responses: { '201': { description: 'Variant group created' } },
      },
      get: {
        tags: ['Variants'],
        summary: 'List Variant Groups',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Variants list' } },
      },
    },
    '/api/v1/variants/{id}': {
      get: {
        tags: ['Variants'],
        summary: 'Get Variant Group',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Variant details' } },
      },
      put: {
        tags: ['Variants'],
        summary: 'Update Variant Group',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVariantDto' } } },
        },
        responses: { '200': { description: 'Variant updated' } },
      },
      delete: {
        tags: ['Variants'],
        summary: 'Delete Variant Group',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Variant deleted' } },
      },
    },

    // ─── MENU & PRODUCTS ──────────────────────────────────────────────────────
    '/api/v1/menu/catalog': {
      get: {
        tags: ['Menu & Products'],
        summary: 'Get Full Menu Catalog (Public / QR Guest)',
        description: 'Returns complete organized menu with categories, products, prices, and options. Cached via Upstash Redis.',
        parameters: [{ name: 'tenantId', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: 'Full catalog' } },
      },
    },
    '/api/v1/menu/rag-catalog/{tenantId}': {
      get: {
        tags: ['Menu & Products'],
        summary: 'Export Menu for RAG & Vector Embeddings',
        description: 'Public endpoint returning clean textual summaries of dishes optimized for LLM chatbots and vector ingestion.',
        parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'RAG catalog array' } },
      },
    },
    '/api/v1/menu/source-documents/{tenantId}': {
      get: {
        tags: ['Menu & Products'],
        summary: 'List Uploaded Menu Source Documents',
        description: 'Returns list of uploaded raw menu files (PDFs, images, CSVs on Cloudinary) with their direct URLs.',
        parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Source documents list' } },
      },
    },
    '/api/v1/menu/upload': {
      post: {
        tags: ['Menu & Products'],
        summary: 'Unified Menu Upload (JSON or File)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Accepts structured JSON catalog (synchronous 201) or a PDF/image file (async QStash queue → 202 Accepted).',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  branchId: { type: 'string' },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  branchId: { type: 'string' },
                  categories: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Menu imported' }, '202': { description: 'File queued for processing' } },
      },
    },
    '/api/v1/menu/uploads/{id}': {
      get: {
        tags: ['Menu & Products'],
        summary: 'Poll Menu Upload Job Status',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Job status (queued, processing, completed, failed)' } },
      },
    },
    '/api/v1/menu/products': {
      post: {
        tags: ['Menu & Products'],
        summary: 'Create Single Dish / Product',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProductDto' } } },
        },
        responses: { '201': { description: 'Product created' } },
      },
      get: {
        tags: ['Menu & Products'],
        summary: 'List Products',
        parameters: [
          { name: 'tenantId', in: 'query', schema: { type: 'string' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Products array' } },
      },
    },
    '/api/v1/menu/products/{id}': {
      get: {
        tags: ['Menu & Products'],
        summary: 'Get Product by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product details' } },
      },
      put: {
        tags: ['Menu & Products'],
        summary: 'Update Product',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProductDto' } } },
        },
        responses: { '200': { description: 'Product updated' } },
      },
      delete: {
        tags: ['Menu & Products'],
        summary: 'Delete Product',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Product deleted' } },
      },
    },
    '/api/v1/menu/bulk-import': {
      post: {
        tags: ['Menu & Products'],
        summary: 'Bulk Import Full Menu Catalog',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Atomic transactional import inserting categories, dishes, and modifier variants in one payload.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['categories'],
                properties: {
                  categories: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Bulk import complete' } },
      },
    },

    // ─── TABLES & QR CODES ────────────────────────────────────────────────────
    '/api/v1/tables/qr/{token}': {
      get: {
        tags: ['Tables & QR Codes'],
        summary: 'Resolve Table QR Token (Public)',
        description: 'Validates JWT QR code token, verifies table binding, and returns tableSessionId.',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'QR resolved' }, '400': { description: 'Invalid token' } },
      },
    },
    '/api/v1/tables/scan/{token}': {
      get: {
        tags: ['Tables & QR Codes'],
        summary: 'Scan Table QR Token & Redirect (Public)',
        description: 'Validates QR token and returns HTTP 302 redirecting user to Telegram Bot or Web App.',
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '302': { description: 'Redirect to chatbot or webapp' } },
      },
    },
    '/api/v1/tables/{id}/history': {
      get: {
        tags: ['Tables & QR Codes'],
        summary: 'Get Table Order History',
        description: 'Retrieves last 30 days order history for a specific table.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Table order history array' } },
      },
    },
    '/api/v1/tables/{id}/qr-image': {
      get: {
        tags: ['Tables & QR Codes'],
        summary: 'Download Table QR Code PNG',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'High-res PNG image', content: { 'image/png': {} } } },
      },
    },
    '/api/v1/tables': {
      post: {
        tags: ['Tables & QR Codes'],
        summary: 'Create Table',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTableDto' } } },
        },
        responses: { '201': { description: 'Table created' } },
      },
      get: {
        tags: ['Tables & QR Codes'],
        summary: 'List Tables',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Tables array' } },
      },
    },
    '/api/v1/tables/{id}': {
      get: {
        tags: ['Tables & QR Codes'],
        summary: 'Get Table Details',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Table found' } },
      },
      put: {
        tags: ['Tables & QR Codes'],
        summary: 'Update Table Status / Capacity',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  number: { type: 'integer' },
                  capacity: { type: 'integer' },
                  status: { type: 'string', enum: ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED'] },
                  currentOrderId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Table updated' } },
      },
      delete: {
        tags: ['Tables & QR Codes'],
        summary: 'Delete Table',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Table deleted' } },
      },
    },

    // ─── CHAT SESSIONS & AI ───────────────────────────────────────────────────
    '/api/v1/chat-sessions/resolve': {
      post: {
        tags: ['Chat Sessions & AI'],
        summary: 'Resolve Opaque Token to Session',
        description: 'Single-use opaque token redemption by Telegram bot or Web chat frontend.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'channel'],
                properties: {
                  token: { type: 'string', example: 'd3f4a9...' },
                  channel: { type: 'string', enum: ['telegram', 'web'], example: 'telegram' },
                  channelUserId: { type: 'string', example: '123456789' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Session resolved' } },
      },
    },
    '/api/v1/chat-sessions/by-channel': {
      get: {
        tags: ['Chat Sessions & AI'],
        summary: 'Get Session by Channel & User ID',
        parameters: [
          { name: 'channel', in: 'query', required: true, schema: { type: 'string', enum: ['telegram', 'web'] } },
          { name: 'channelUserId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Active session' } },
      },
    },
    '/api/v1/chat-sessions/close': {
      post: {
        tags: ['Chat Sessions & AI'],
        summary: 'Close Active Chat Session',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId'],
                properties: { sessionId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Session closed' } },
      },
    },
    '/api/v1/chat-sessions/save-table': {
      post: {
        tags: ['Chat Sessions & AI'],
        summary: 'Bind Telegram Chat ID to Table Context',
        description: 'Public endpoint trusted by n8n Telegram workflow to persist long-lived table context (TTL 30 days in Redis).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['chatId', 'tableId'],
                properties: {
                  chatId: { type: 'string', example: '987654321' },
                  tableId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c0' },
                  tenantId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c5' },
                  tableSessionId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Table bound successfully' } },
      },
    },
    '/api/v1/chat-sessions/context/{chatId}': {
      get: {
        tags: ['Chat Sessions & AI'],
        summary: 'Get Table Context for Chat ID',
        description: 'Returns table and tenant context bound to Telegram chatId. Used by n8n on every incoming user message.',
        parameters: [{ name: 'chatId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Bound context' }, '404': { description: 'No binding found' } },
      },
    },
    '/api/v1/chat-sessions/search': {
      post: {
        tags: ['Chat Sessions & AI'],
        summary: 'Session-Scoped Semantic Menu Search',
        description: 'Chatbot endpoint querying menu items using natural language.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  sessionId: { type: 'string' },
                  tenantId: { type: 'string' },
                  query: { type: 'string', example: 'What spicy chicken burgers do you offer?' },
                  topK: { type: 'integer', example: 5 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Semantic search matches' } },
      },
    },
    '/api/v1/vector/search': {
      get: {
        tags: ['Vector Search'],
        summary: 'Staff Semantic Menu Search',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'topK', in: 'query', schema: { type: 'integer', default: 5 } },
        ],
        responses: { '200': { description: 'Vector search matches' } },
      },
    },

    // ─── ORDERS & POS ─────────────────────────────────────────────────────────
    '/api/v1/orders/qr': {
      post: {
        tags: ['Orders & POS'],
        summary: 'Customer Dine-In Self-Service QR Ordering (Public)',
        description: 'Gated by tableSessionId obtained from QR code scanning.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePublicQrOrderDto' } } },
        },
        responses: { '201': { description: 'Order created' } },
      },
    },
    '/api/v1/orders/customer': {
      post: {
        tags: ['Orders & POS'],
        summary: 'Customer Takeaway / Delivery Self-Service Ordering (Public)',
        description: 'Self-service ordering for online / chatbot customers (identified by name + phone).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCustomerOrderDto' } } },
        },
        responses: { '201': { description: 'Order created' } },
      },
    },
    '/api/v1/orders/{id}': {
      get: {
        tags: ['Orders & POS'],
        summary: 'Track Single Order Status (Public / Guest)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order status details' } },
      },
      patch: {
        tags: ['Orders & POS'],
        summary: 'Update Order Status',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'PAID', 'COMPLETED', 'CANCELLED'],
                    example: 'CONFIRMED',
                  },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Status updated' } },
      },
    },
    '/api/v1/orders': {
      get: {
        tags: ['Orders & POS'],
        summary: 'List Orders',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'channel', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Orders array' } },
      },
      post: {
        tags: ['Orders & POS'],
        summary: 'Create POS Order (Staff)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Staff cashier / waiter POS order creation.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subtotal', 'totalAmount', 'items'],
                properties: {
                  branchId: { type: 'string' },
                  channel: { type: 'string', enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QR'], default: 'DINE_IN' },
                  tableId: { type: 'string' },
                  items: { type: 'array', items: { type: 'object' } },
                  subtotal: { type: 'number' },
                  taxAmount: { type: 'number' },
                  totalAmount: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Order created' } },
      },
    },
    '/api/v1/orders/offline-sync': {
      post: {
        tags: ['Orders & POS'],
        summary: 'Synchronize Offline POS Orders',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Batch synchronization of orders taken when internet connection was disrupted.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orders'],
                properties: {
                  branchId: { type: 'string' },
                  orders: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Sync completed' } },
      },
    },
    '/api/v1/orders/{id}/confirm-cashier': {
      post: {
        tags: ['Orders & POS'],
        summary: 'Cashier Confirmation (Send to KDS Kitchen)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order confirmed and routed to Kitchen' } },
      },
    },
    '/api/v1/orders/{id}/complete-kitchen': {
      post: {
        tags: ['Orders & POS'],
        summary: 'Kitchen Complete (Mark Ready for Serving)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order marked as READY' } },
      },
    },
    '/api/v1/orders/{id}/complete': {
      post: {
        tags: ['Orders & POS'],
        summary: 'Complete Order & Free Table',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Order marked as COMPLETED and table freed' } },
      },
    },

    // ─── COUPONS ──────────────────────────────────────────────────────────────
    '/api/v1/coupons/validate': {
      get: {
        tags: ['Coupons'],
        summary: 'Validate Coupon Code (Query)',
        parameters: [
          { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'tenantId', in: 'query', schema: { type: 'string' } },
          { name: 'orderAmount', in: 'query', schema: { type: 'number' } },
        ],
        responses: { '200': { description: 'Coupon valid' }, '400': { description: 'Invalid or expired' } },
      },
      post: {
        tags: ['Coupons'],
        summary: 'Validate Coupon Code (Body)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string', example: 'SUMMER20' },
                  orderAmount: { type: 'number', example: 350 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Coupon valid' } },
      },
    },
    '/api/v1/coupons': {
      post: {
        tags: ['Coupons'],
        summary: 'Create Coupon',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCouponDto' } } },
        },
        responses: { '201': { description: 'Coupon created' } },
      },
      get: {
        tags: ['Coupons'],
        summary: 'List Coupons',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Coupons array' } },
      },
    },
    '/api/v1/coupons/{id}': {
      put: {
        tags: ['Coupons'],
        summary: 'Update Coupon',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCouponDto' } } },
        },
        responses: { '200': { description: 'Coupon updated' } },
      },
      delete: {
        tags: ['Coupons'],
        summary: 'Delete Coupon',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Coupon deleted' } },
      },
    },

    // ─── CUSTOMERS & EMPLOYEES ────────────────────────────────────────────────
    '/api/v1/customers': {
      post: {
        tags: ['Customers'],
        summary: 'Create Customer',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone'],
                properties: {
                  name: { type: 'string', example: 'Omar Khaled' },
                  phone: { type: 'string', example: '+201022334455' },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Customer created' } },
      },
      get: {
        tags: ['Customers'],
        summary: 'List Customers',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Customers array' } },
      },
    },
    '/api/v1/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'Get Customer Details',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Customer found' } },
      },
      put: {
        tags: ['Customers'],
        summary: 'Update Customer',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Customer updated' } },
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete Customer',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Customer deleted' } },
      },
    },
    '/api/v1/employees': {
      post: {
        tags: ['Employees'],
        summary: 'Create Employee',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['branchId', 'fullName', 'position', 'phone'],
                properties: {
                  branchId: { type: 'string', example: '6a6b3e8447dedf5d12fef0c4' },
                  fullName: { type: 'string', example: 'Karim Nabil' },
                  position: { type: 'string', example: 'Head Chef' },
                  phone: { type: 'string', example: '+201011335577' },
                  hourlyRate: { type: 'number', example: 45 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Employee created' } },
      },
      get: {
        tags: ['Employees'],
        summary: 'List Employees',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Employees array' } },
      },
    },
    '/api/v1/employees/{id}': {
      get: {
        tags: ['Employees'],
        summary: 'Get Employee',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Employee found' } },
      },
      put: {
        tags: ['Employees'],
        summary: 'Update Employee',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Employee updated' } },
      },
      delete: {
        tags: ['Employees'],
        summary: 'Delete Employee',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Employee deleted' } },
      },
    },

    // ─── FEEDBACK, REPORTS, NOTIFICATIONS ─────────────────────────────────────
    '/api/v1/feedback': {
      post: {
        tags: ['Feedback'],
        summary: 'Submit Guest Dining Rating (Public)',
        description: 'Customers submit 1-5 star ratings and comments after dining.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['rating'],
                properties: {
                  branchId: { type: 'string' },
                  orderId: { type: 'string' },
                  rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
                  comment: { type: 'string', example: 'Outstanding food and lightning fast service!' },
                  customerName: { type: 'string', example: 'Hany F.' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Feedback received' } },
      },
      get: {
        tags: ['Feedback'],
        summary: 'List Feedback Entries (Staff)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Feedback list' } },
      },
    },
    '/api/v1/reports/sales': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Get Sales & Revenue Report',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Sales metrics and daily breakdowns' } },
      },
    },
    '/api/v1/reports/orders-by-table': {
      get: {
        tags: ['Reports & Analytics'],
        summary: 'Get Orders Grouped by Dining Table',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Table order metrics' } },
      },
    },
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List Notification Audit Logs',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        description: 'Audit log of all sent and queued OTPs, receipts, and alert messages.',
        responses: { '200': { description: 'Notification logs array' } },
      },
    },
    '/api/v1/notifications/dispatch': {
      post: {
        tags: ['Notifications'],
        summary: 'Dispatch Notification (Staff)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['channel', 'recipient', 'message'],
                properties: {
                  channel: { type: 'string', enum: ['EMAIL', 'TELEGRAM'], example: 'EMAIL' },
                  recipient: { type: 'string', example: 'guest@example.com' },
                  subject: { type: 'string', example: 'Your Dining Receipt' },
                  message: { type: 'string', example: 'Thank you for dining with us!' },
                  branchId: { type: 'string' },
                  tableNumber: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Notification queued or sent' } },
      },
    },

    // ─── RESERVATIONS ─────────────────────────────────────────────────────────
    '/api/v1/reservations': {
      post: {
        tags: ['Reservations'],
        summary: 'Create Table Reservation (Public / Bot)',
        description: 'Webhook/public guest reservation endpoint used by Telegram chatbot.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateReservationDto' } } },
        },
        responses: { '201': { description: 'Reservation created' } },
      },
      get: {
        tags: ['Reservations'],
        summary: 'List Reservations (Staff)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        responses: { '200': { description: 'Reservations array' } },
      },
    },
    '/api/v1/reservations/{id}': {
      patch: {
        tags: ['Reservations'],
        summary: 'Update Reservation Status (Staff)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW'], example: 'SEATED' },
                  tableId: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Reservation updated' } },
      },
      delete: {
        tags: ['Reservations'],
        summary: 'Cancel Reservation (Staff)',
        security: [{ BearerAuth: [] }, { TenantHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Reservation cancelled' } },
      },
    },

    // ─── QSTASH BACKGROUND WEBHOOK JOBS ───────────────────────────────────────
    '/api/v1/jobs/emails': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Email Job',
        security: [{ QStashSignature: [] }],
        description: 'Serverless webhook dispatched by Upstash QStash to send transactional emails via Resend.',
        responses: { '200': { description: 'Processed' }, '500': { description: 'Retry queued by QStash' } },
      },
    },
    '/api/v1/jobs/telegram': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Telegram Job',
        security: [{ QStashSignature: [] }],
        description: 'Dispatches alert or receipt message to Telegram user/group.',
        responses: { '200': { description: 'Processed' } },
      },
    },
    '/api/v1/jobs/invoices': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Invoice Generation Job',
        security: [{ QStashSignature: [] }],
        responses: { '200': { description: 'Invoice generated' } },
      },
    },
    '/api/v1/jobs/subscription-checks': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Daily Subscription Audit Job',
        security: [{ QStashSignature: [] }],
        description: 'Checks for expired trials or renewal periods and marks status.',
        responses: { '200': { description: 'Audit completed' } },
      },
    },
    '/api/v1/jobs/payment-retries': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Payment Retry Job',
        security: [{ QStashSignature: [] }],
        responses: { '200': { description: 'Payment retry processed' } },
      },
    },
    '/api/v1/jobs/backups': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Database Backup Job',
        security: [{ QStashSignature: [] }],
        responses: { '200': { description: 'Backup completed' } },
      },
    },
    '/api/v1/jobs/firestore-retry': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Firestore Offline Sync Retry Job',
        security: [{ QStashSignature: [] }],
        responses: { '200': { description: 'Sync completed' } },
      },
    },
    '/api/v1/jobs/table-history-cleanup': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Table History Cleanup Job',
        security: [{ QStashSignature: [] }],
        description: 'Prunes table history older than cutoff date.',
        responses: { '200': { description: 'Cleanup completed' } },
      },
    },
    '/api/v1/jobs/vector-sync': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Vector Index Sync Job',
        security: [{ QStashSignature: [] }],
        description: 'Generates Gemini embeddings and writes vectors into Upstash Vector index.',
        responses: { '200': { description: 'Vector sync completed' } },
      },
    },
    '/api/v1/jobs/menu-ingestion': {
      post: {
        tags: ['QStash Background Jobs'],
        summary: 'Process Menu File Ingestion Job (Gemini OCR)',
        security: [{ QStashSignature: [] }],
        description: 'Extracts dishes and prices from uploaded PDF or image using Gemini multimodal AI.',
        responses: { '200': { description: 'Menu ingestion completed' } },
      },
    },
  },
};

export function getSwaggerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restaurant SaaS Platform — Swagger API Documentation</title>
  <link rel="stylesheet" href="/docs-assets/swagger-ui.css" />
  <link rel="icon" type="image/png" href="/docs-assets/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; padding: 0; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .topbar { display: none !important; }
    .swagger-ui .info { margin: 25px 0 20px 0; }
    .swagger-ui .info .title { font-size: 28px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/docs-assets/swagger-ui-bundle.js"></script>
  <script src="/docs-assets/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '/docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
}

export function handleDocsJson(_req: Request, res: Response): void {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(openApiSpec);
}

export function handleSwaggerUi(_req: Request, res: Response): void {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; img-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com; font-src 'self' https: data:; connect-src 'self' *;"
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(getSwaggerHtml());
}
