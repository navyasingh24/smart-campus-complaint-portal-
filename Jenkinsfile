// Jenkins pipeline for the Smart Campus Complaint Portal.
//
// Stages: Checkout -> Tests (backend + frontend build) -> Docker build & smoke
// test -> Terraform fmt/validate -> Terraform plan -> Terraform apply (manual
// approval) -> Deploy to Render.
//
// Deployment runs only after every earlier stage has passed, only for the
// main branch, and only when DEPLOY_MODE=jenkins. With the default
// DEPLOY_MODE=github, GitHub Actions keeps deploying and Jenkins skips the
// Deploy stage, so the two systems never deploy the same commit twice.
//
// Jenkins configuration used (Manage Jenkins > System > Global properties):
//   DEPLOY_MODE        github (default) | jenkins
//   RENDER_APP_URL     https://<your-app>.onrender.com
//   TERRAFORM_ENABLED  true once the Render credentials below exist
//   RENDER_SERVICE_ID  srv-... (the existing Blueprint web service)
// Credentials (Manage Jenkins > Credentials, kind "Secret text"):
//   render-deploy-hook-url, render-api-key, render-owner-id

def isMainBranch() {
  return env.BRANCH_NAME == 'main' || env.GIT_BRANCH in ['main', 'origin/main', 'refs/heads/main']
}

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 60, unit: 'MINUTES')
  }

  triggers {
    githubPush()               // GitHub webhook -> /github-webhook/
    pollSCM('H/5 * * * *')     // fallback when the webhook cannot reach Jenkins
  }

  environment {
    TF_IN_AUTOMATION = 'true'
    TF_INPUT = '0'
    // Outside the workspace, in the persistent jenkins-data volume.
    TF_STATE_PATH = "${env.JENKINS_HOME}/terraform-state/smart-campus/terraform.tfstate"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
          env.IMAGE_TAG = "smart-campus:${env.BUILD_NUMBER}"
          echo "Building commit ${env.GIT_SHA} (branch: ${env.BRANCH_NAME ?: env.GIT_BRANCH})"
        }
      }
    }

    stage('Tests') {
      parallel {
        stage('Backend tests') {
          steps {
            dir('backend') {
              sh 'npm ci'
              sh 'npm run test:coverage'
            }
          }
          post {
            always {
              archiveArtifacts artifacts: 'backend/coverage/lcov-report/**', allowEmptyArchive: true
            }
          }
        }
        stage('Frontend build') {
          steps {
            dir('frontend') {
              sh 'npm ci'
              sh 'npm run build'
            }
          }
        }
      }
    }

    stage('Docker build & smoke test') {
      steps {
        sh 'docker build --build-arg APP_VERSION="$GIT_SHA" -t "$IMAGE_TAG" .'
        sh 'bash jenkins/smoke-test.sh "$IMAGE_TAG" "$GIT_SHA" "smoke-$BUILD_NUMBER"'
      }
      post {
        always {
          sh 'docker rm -f "smoke-$BUILD_NUMBER" >/dev/null 2>&1 || true'
          sh 'docker image rm "$IMAGE_TAG" >/dev/null 2>&1 || true'
        }
      }
    }

    stage('Terraform fmt & validate') {
      steps {
        dir('terraform') {
          sh 'terraform fmt -check -recursive -diff'
          sh 'terraform init -backend=false -input=false'
          sh 'terraform validate'
        }
      }
    }

    stage('Terraform plan') {
      when {
        environment name: 'TERRAFORM_ENABLED', value: 'true'
      }
      steps {
        withCredentials([
          string(credentialsId: 'render-api-key', variable: 'RENDER_API_KEY'),
          string(credentialsId: 'render-owner-id', variable: 'RENDER_OWNER_ID')
        ]) {
          dir('terraform') {
            sh 'mkdir -p "$(dirname "$TF_STATE_PATH")"'
            sh 'terraform init -input=false -reconfigure -backend-config="path=$TF_STATE_PATH"'
            script {
              withEnv(["TF_VAR_render_service_id=${env.RENDER_SERVICE_ID ?: ''}"]) {
                // 0 = no changes, 1 = error, 2 = changes present
                def code = sh(returnStatus: true,
                  script: 'terraform plan -input=false -detailed-exitcode -out=tfplan')
                if (code == 1) {
                  error('terraform plan failed')
                }
                env.TF_HAS_CHANGES = (code == 2) ? 'true' : 'false'
              }
              sh 'terraform show -no-color tfplan > tfplan.txt'
              env.TF_DESTROY_COUNT = sh(returnStdout: true,
                script: '''terraform show -json tfplan | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const p=JSON.parse(s);console.log((p.resource_changes||[]).filter((r)=>r.change.actions.includes("delete")).length)})' ''').trim()
              echo "Terraform changes pending: ${env.TF_HAS_CHANGES}, resources to delete/replace: ${env.TF_DESTROY_COUNT}"
            }
          }
        }
      }
      post {
        always {
          archiveArtifacts artifacts: 'terraform/tfplan.txt', allowEmptyArchive: true
        }
      }
    }

    stage('Terraform apply') {
      when {
        allOf {
          environment name: 'TERRAFORM_ENABLED', value: 'true'
          expression { env.TF_HAS_CHANGES == 'true' && isMainBranch() }
        }
      }
      steps {
        script {
          def warning = env.TF_DESTROY_COUNT != '0'
            ? "WARNING: this plan deletes or replaces ${env.TF_DESTROY_COUNT} resource(s). "
            : ''
          def approved = false
          try {
            timeout(time: 30, unit: 'MINUTES') {
              input message: "${warning}Apply the Terraform plan to Render? (see tfplan.txt in the build artifacts)",
                    ok: 'Apply'
            }
            approved = true
          } catch (err) {
            echo 'Terraform apply was not approved (rejected or timed out); infrastructure left unchanged.'
          }
          if (approved) {
            withCredentials([
              string(credentialsId: 'render-api-key', variable: 'RENDER_API_KEY'),
              string(credentialsId: 'render-owner-id', variable: 'RENDER_OWNER_ID')
            ]) {
              dir('terraform') {
                sh 'terraform apply -input=false tfplan'
              }
            }
          }
        }
      }
    }

    stage('Deploy to Render') {
      when {
        expression { isMainBranch() && (env.DEPLOY_MODE ?: 'github') == 'jenkins' }
      }
      steps {
        withCredentials([string(credentialsId: 'render-deploy-hook-url', variable: 'RENDER_DEPLOY_HOOK_URL')]) {
          sh 'EXPECTED_VERSION="$GIT_SHA" bash jenkins/deploy-render.sh'
        }
      }
    }
  }

  post {
    success {
      script {
        if (isMainBranch() && (env.DEPLOY_MODE ?: 'github') != 'jenkins') {
          echo 'Pipeline passed. Deploy stage skipped because DEPLOY_MODE is not "jenkins" (GitHub Actions deploys).'
        }
      }
    }
    always {
      sh 'rm -f terraform/tfplan || true'
    }
  }
}
