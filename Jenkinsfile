pipeline {
  agent {
    docker {
      image 'node:20-bookworm'
      args '-u root:root'
    }
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 45, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    CI = 'true'
    NODE_ENV = 'test'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        sh 'node -v && npm -v'
        sh 'npm ci --ignore-scripts'
      }
    }

    stage('Prisma') {
      steps {
        sh 'npm run prisma:generate'
      }
    }

    stage('Typecheck API') {
      steps {
        sh 'npm run typecheck:api'
      }
    }

    stage('Typecheck Web') {
      steps {
        sh 'npm run typecheck:web'
      }
    }

    stage('Typecheck Mobile') {
      steps {
        // La app móvil (Expo) mantiene node_modules aislado, fuera de los workspaces.
        sh 'npm run typecheck:mobile'
      }
    }

    stage('Unit tests (Jest)') {
      steps {
        sh 'npm run test:ci'
      }
      post {
        always {
          archiveArtifacts artifacts: 'apps/*/coverage/**/*', allowEmptyArchive: true
        }
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build:api'
        sh 'npm run build:web'
      }
    }

    stage('Geopy smoke (optional)') {
      when {
        expression { return fileExists('apps/api/geopy/geocode.py') }
      }
      steps {
        sh '''
          apt-get update -qq
          apt-get install -y -qq python3 python3-venv python3-pip >/dev/null
          python3 -m venv /tmp/fr-geopy
          /tmp/fr-geopy/bin/pip install -q -r apps/api/geopy/requirements.txt
          echo '{"action":"forward","query":"Guadalajara, Jalisco","country":"mx"}' \
            | /tmp/fr-geopy/bin/python apps/api/geopy/geocode.py \
            | grep -q '"ok": true'
        '''
      }
    }
  }

  post {
    success {
      echo 'QA pipeline green — safe to merge/deploy.'
    }
    failure {
      echo 'QA pipeline failed — inspect Jest/build logs.'
    }
    always {
      echo "Build finished: ${currentBuild.currentResult}"
    }
  }
}
