# Infrastructure as Code — SaaS Agentic Booking Chat

Este repositorio contiene toda la infraestructura como código (IaC) para desplegar el sistema en AWS.

## 📁 Estructura del proyecto

```
infrastructure/
├── cdk/                     # AWS CDK (TypeScript)
│   ├── bin/
│   │   └── app.ts
│   ├── lib/
│   │   ├── database-stack.ts
│   │   ├── appsync-api-stack.ts
│   │   ├── auth-stack.ts
│   │   └── lambda-stack.ts
│   ├── package.json
│   └── cdk.json
│
├── cloudformation/          # AWS CloudFormation (YAML) - RECOMENDADO
│   ├── master-stack.yaml
│   ├── nested-stacks/
│   │   ├── database-stack.yaml
│   │   ├── auth-stack.yaml
│   │   ├── lambda-stack.yaml
│   │   ├── appsync-api-stack.yaml
│   │   └── monitoring-stack.yaml
│   └── deploy.sh
│
└── scripts/
    ├── deploy-dev.sh
    ├── deploy-prod.sh
    └── rollback.sh
```

## 🚀 Despliegue con CloudFormation (Recomendado)

### Prerequisitos

1. AWS CLI instalado y configurado
2. Permisos de IAM necesarios
3. Código del backend empaquetado

### Despliegue rápido

```bash
cd cloudformation

# Desplegar ambiente de desarrollo
./deploy.sh dev

# Desplegar ambiente de producción
./deploy.sh prod
```

### Despliegue manual paso a paso

```bash
# 1. Crear buckets S3 necesarios
aws s3 mb s3://ChatBooking-cloudformation-templates-dev
aws s3 mb s3://ChatBooking-lambda-packages-dev

# 2. Subir templates
aws s3 sync nested-stacks/ s3://ChatBooking-cloudformation-templates-dev/nested-stacks/
aws s3 cp master-stack.yaml s3://ChatBooking-cloudformation-templates-dev/

# 3. Empaquetar y subir código Lambda
cd ../../chat-booking-backend
# (empaquetar funciones)
aws s3 sync dist/ s3://ChatBooking-lambda-packages-dev/

# 4. Desplegar stack
cd ../chat-booking-infrastructure/cloudformation
aws cloudformation deploy \
  --template-file master-stack.yaml \
  --stack-name ChatBooking-dev \
  --parameter-overrides \
      Environment=dev \
      ProjectName=ChatBooking \
      S3BucketTemplates=ChatBooking-cloudformation-templates-dev \
      BackendCodeBucket=ChatBooking-lambda-packages-dev \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --region us-east-1
```

### Ventajas de CloudFormation Nested Stacks

✅ **Modularidad**: Cada stack nested es independiente y reutilizable  
✅ **Límites aumentados**: Supera el límite de 500 recursos por stack  
✅ **Despliegue paralelo**: Los stacks sin dependencias se despliegan en paralelo  
✅ **Rollback granular**: Rollback individual de nested stacks  
✅ **Gestión simplificada**: Un master stack controla todo  
✅ **YAML nativo**: Sin necesidad de compilar TypeScript  

## 🚀 Despliegue con CDK (Alternativo)

```bash
cd cdk
npm install
cdk bootstrap
cdk deploy --all
```

## 📊 Arquitectura de Nested Stacks

```
master-stack.yaml
├── database-stack.yaml (DynamoDB tables)
├── auth-stack.yaml (Cognito User Pool)
├── lambda-stack.yaml (Lambda functions + Layer)
│   └── Depends on: database-stack
├── appsync-api-stack.yaml (GraphQL API)
│   └── Depends on: lambda-stack, auth-stack
└── monitoring-stack.yaml (CloudWatch Dashboard + Alarms)
    └── Depends on: lambda-stack, appsync-api-stack
```

## 🏷️ Tags aplicados a todos los recursos

Todos los recursos CloudFormation incluyen tags estándar:

- `Project`: ChatBooking
- `Environment`: dev/qa/prod
- `ManagedBy`: CloudFormation
- `Name`: Nombre descriptivo del recurso

## 📚 Documentación

- [Deployment Guide](../chat-booking-docs/deployment/README.md)
- [Architecture](../chat-booking-docs/architecture/README.md)
- [DynamoDB Schema](../chat-booking-docs/architecture/dynamodb-schema.md)
- [AppSync Schema](../chat-booking-docs/architecture/appsync-schema.md)
