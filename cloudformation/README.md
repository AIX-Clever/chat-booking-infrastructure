# CloudFormation - Chat Booking SaaS Infrastructure

Esta carpeta contiene la infraestructura completa en CloudFormation con arquitectura de **Nested Stacks**.

## 📁 Estructura

```
cloudformation/
├── master-stack.yaml              # Stack principal que orquesta todo
├── nested-stacks/                 # Stacks modulares
│   ├── database-stack.yaml        # 7 tablas DynamoDB
│   ├── auth-stack.yaml            # Cognito User Pool
│   ├── lambda-stack.yaml          # 5 Lambdas + Layer
│   ├── appsync-api-stack.yaml     # GraphQL API
│   └── monitoring-stack.yaml      # Dashboard + Alarms
├── deploy.sh                      # Script de despliegue automático
├── teardown.sh                    # Script de eliminación
├── validate.sh                    # Validación de templates
├── parameters-example.json        # Ejemplo de parámetros
└── .gitignore
```

## 🚀 Despliegue Rápido

### Prerequisitos

1. **AWS CLI instalado y configurado**
   ```bash
   aws configure
   ```

2. **Código del backend empaquetado**
   - Las Lambdas deben estar en `../../chat-booking-backend/`
   - Cada función debe tener su `requirements.txt`

3. **Permisos IAM necesarios**
   - CloudFormation
   - DynamoDB
   - Lambda
   - AppSync
   - Cognito
   - CloudWatch
   - S3
   - IAM

### Opción 1: Script Automático (Recomendado)

```bash
# Desplegar ambiente de desarrollo
./deploy.sh dev

# Desplegar ambiente de producción
./deploy.sh prod
```

El script automáticamente:
- ✅ Crea los buckets S3 necesarios
- ✅ Empaqueta las funciones Lambda
- ✅ Sube el código a S3
- ✅ Sube los templates a S3
- ✅ Valida los templates
- ✅ Despliega el stack completo
- ✅ Muestra los outputs importantes

### Opción 2: Despliegue Manual

#### Paso 1: Crear buckets S3

```bash
ENVIRONMENT=dev
PROJECT_NAME=ChatBooking

aws s3 mb s3://${PROJECT_NAME}-cloudformation-templates-${ENVIRONMENT}
aws s3 mb s3://${PROJECT_NAME}-lambda-packages-${ENVIRONMENT}
```

#### Paso 2: Empaquetar funciones Lambda

```bash
cd ../../chat-booking-backend

# Crear directorio de distribución
mkdir -p ../chat-booking-infrastructure/cloudformation/dist/functions
mkdir -p ../chat-booking-infrastructure/cloudformation/dist/layers

# Empaquetar cada función
for dir in auth_resolver catalog availability booking chat_agent; do
    cd $dir
    pip install -r requirements.txt -t .
    zip -r ../../../chat-booking-infrastructure/cloudformation/dist/functions/${dir}.zip .
    cd ..
done

# Empaquetar shared layer
cd shared
mkdir -p python
pip install -r requirements.txt -t python/ 2>/dev/null || true
cp -r *.py domain/ infrastructure/ python/
zip -r ../../chat-booking-infrastructure/cloudformation/dist/layers/shared-layer.zip python/
rm -rf python/
```

#### Paso 3: Subir código a S3

```bash
cd ../../chat-booking-infrastructure/cloudformation

aws s3 sync dist/functions/ s3://${PROJECT_NAME}-lambda-packages-${ENVIRONMENT}/functions/
aws s3 sync dist/layers/ s3://${PROJECT_NAME}-lambda-packages-${ENVIRONMENT}/layers/
```

#### Paso 4: Subir templates a S3

```bash
aws s3 sync nested-stacks/ s3://${PROJECT_NAME}-cloudformation-templates-${ENVIRONMENT}/nested-stacks/
aws s3 cp master-stack.yaml s3://${PROJECT_NAME}-cloudformation-templates-${ENVIRONMENT}/
```

#### Paso 5: Desplegar stack

```bash
aws cloudformation deploy \
  --template-file master-stack.yaml \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT} \
  --parameter-overrides \
      Environment=${ENVIRONMENT} \
      ProjectName=${PROJECT_NAME} \
      S3BucketTemplates=${PROJECT_NAME}-cloudformation-templates-${ENVIRONMENT} \
      BackendCodeBucket=${PROJECT_NAME}-lambda-packages-${ENVIRONMENT} \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --region us-east-1
```

#### Paso 6: Obtener outputs

```bash
aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT} \
  --query 'Stacks[0].Outputs' \
  --output table
```

## 🔍 Validación de Templates

Antes de desplegar, valida que todos los templates sean correctos:

```bash
./validate.sh
```

## 🏷️ Tags Aplicados

Todos los recursos incluyen estos tags:

- `Project`: ChatBooking
- `Environment`: dev/qa/prod
- `ManagedBy`: CloudFormation
- `Name`: Nombre descriptivo del recurso

## 📊 Arquitectura de Nested Stacks

```
master-stack.yaml
│
├─── database-stack.yaml
│    └── 7 tablas DynamoDB con GSIs, PITR, encryption
│
├─── auth-stack.yaml
│    └── Cognito User Pool + Client + Groups
│
├─── lambda-stack.yaml (depende de database-stack)
│    ├── Shared Layer
│    ├── Auth Resolver Function
│    ├── Catalog Function
│    ├── Availability Function
│    ├── Booking Function
│    └── Chat Agent Function
│
├─── appsync-api-stack.yaml (depende de lambda-stack + auth-stack)
│    ├── GraphQL API
│    ├── API Key
│    ├── Schema completo
│    ├── Data Sources (Lambda)
│    └── Resolvers
│
└─── monitoring-stack.yaml (depende de lambda-stack + appsync-api-stack)
     ├── CloudWatch Dashboard
     ├── SNS Topic (opcional)
     ├── Error Alarms
     ├── Duration Alarms
     └── Composite Health Alarm
```

## 🔄 Actualización del Stack

Para actualizar recursos existentes:

```bash
# Modificar templates según necesidad
vim nested-stacks/lambda-stack.yaml

# Validar cambios
./validate.sh

# Desplegar actualización
./deploy.sh dev
```

CloudFormation creará un **change set** y solo modificará los recursos que cambiaron.

## 🗑️ Eliminación del Stack

⚠️ **CUIDADO**: Esto eliminará TODOS los datos.

```bash
./teardown.sh dev
```

El script pedirá confirmación explícita escribiendo `DELETE`.

## 📈 Monitoreo Post-Despliegue

### CloudWatch Dashboard

URL del dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=ChatBooking-{env}-Dashboard
```

### Alarmas Configuradas

- ✅ Lambda: Errores, Throttles, Duration
- ✅ AppSync: 4xx, 5xx, Latency
- ✅ Composite Alarm para salud general del sistema

### Logs

Todos los logs están en CloudWatch Logs con retención de 7 días:
```
/aws/lambda/ChatBooking-{env}-AuthResolver
/aws/lambda/ChatBooking-{env}-Catalog
/aws/lambda/ChatBooking-{env}-Availability
/aws/lambda/ChatBooking-{env}-Booking
/aws/lambda/ChatBooking-{env}-ChatAgent
```

## 🔐 Configuración de Parámetros

Crea archivos de parámetros para cada ambiente:

```bash
# Copiar ejemplo
cp parameters-example.json parameters-dev.json

# Editar con valores reales
vim parameters-dev.json
```

Ejemplo de `parameters-dev.json`:
```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "dev"
  },
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "ChatBooking"
  },
  {
    "ParameterKey": "S3BucketTemplates",
    "ParameterValue": "ChatBooking-cloudformation-templates-dev"
  },
  {
    "ParameterKey": "BackendCodeBucket",
    "ParameterValue": "ChatBooking-lambda-packages-dev"
  }
]
```

Desplegar usando archivo de parámetros:
```bash
aws cloudformation deploy \
  --template-file master-stack.yaml \
  --stack-name ChatBooking-dev \
  --parameter-overrides file://parameters-dev.json \
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
```

## 🐛 Troubleshooting

### Error: "Stack already exists"

```bash
# Ver estado actual
aws cloudformation describe-stacks --stack-name ChatBooking-dev

# Si está en ROLLBACK_COMPLETE, eliminar primero
aws cloudformation delete-stack --stack-name ChatBooking-dev
aws cloudformation wait stack-delete-complete --stack-name ChatBooking-dev

# Reintentar despliegue
./deploy.sh dev
```

### Error: "Insufficient permissions"

Asegúrate de tener estos permisos IAM:
- `cloudformation:*`
- `dynamodb:*`
- `lambda:*`
- `appsync:*`
- `cognito-idp:*`
- `iam:CreateRole`, `iam:AttachRolePolicy`, etc.
- `s3:*`
- `logs:*`

### Error en nested stack

```bash
# Ver eventos del stack fallido
aws cloudformation describe-stack-events \
  --stack-name ChatBooking-dev-DatabaseStack-XXXXX \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

### Lambda no puede acceder a DynamoDB

Verifica que el IAM Role tenga los permisos correctos. Revisa:
```bash
aws cloudformation describe-stack-resources \
  --stack-name ChatBooking-dev-LambdaStack-XXXXX \
  --query 'StackResources[?LogicalResourceId==`LambdaExecutionRole`]'
```

## 📚 Documentación Relacionada

- [Deployment Guide](../../chat-booking-docs/deployment/README.md)
- [Architecture Overview](../../chat-booking-docs/architecture/README.md)
- [DynamoDB Schema](../../chat-booking-docs/architecture/dynamodb-schema.md)
- [AppSync Schema](../../chat-booking-docs/architecture/appsync-schema.md)
- [Lambda Functions](../../chat-booking-docs/architecture/lambdas.md)

## 🆘 Soporte

Para problemas o preguntas:
1. Revisar logs en CloudWatch
2. Verificar eventos de CloudFormation
3. Consultar documentación de AWS
4. Revisar issues en el repositorio

## 📝 Notas Importantes

- ⚠️ Los buckets S3 NO se eliminan automáticamente al borrar el stack
- ⚠️ Las tablas DynamoDB tienen `RemovalPolicy: RETAIN` por seguridad
- ✅ Siempre hacer backup antes de actualizaciones en producción
- ✅ Probar cambios en `dev` antes de aplicar en `prod`
- ✅ Los nested stacks permiten rollback granular
