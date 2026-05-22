pipeline {
    agent any

    environment {
        APP_DIR = 'C:\\apps\\aramsamsam\\app'
        DATA_DIR = 'C:\\apps\\aramsamsam\\data'
    }

    stages {
        stage('Install') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Check') {
            steps {
                bat 'npm run check'
                bat 'npm test'
            }
        }

        stage('Deploy Files') {
            steps {
                powershell '''
                    New-Item -ItemType Directory -Force -Path $env:APP_DIR | Out-Null
                    New-Item -ItemType Directory -Force -Path $env:DATA_DIR | Out-Null
                    New-Item -ItemType Directory -Force -Path "$env:DATA_DIR\\champs" | Out-Null

                    robocopy . $env:APP_DIR /MIR /XD .git node_modules data champs /XF .env users.json moreusers.json champs.json aramsam.zip
                    if ($LASTEXITCODE -le 7) { exit 0 } else { exit $LASTEXITCODE }
                '''
            }
        }

        stage('Production Install') {
            steps {
                dir("${env.APP_DIR}") {
                    bat 'npm ci --omit=dev'
                }
            }
        }

        stage('Restart PM2') {
            steps {
                dir("${env.APP_DIR}") {
                    bat 'pm2 startOrReload ecosystem.config.cjs --env production'
                    bat 'pm2 save'
                }
            }
        }

        stage('Healthcheck') {
            steps {
                powershell 'Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7071/health'
            }
        }
    }
}
