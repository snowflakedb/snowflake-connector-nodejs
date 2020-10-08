timestamps {
  node('regular-memory-slave') {
    stage('checkout') {
      scmInfo = checkout scm
      println("${scmInfo}")
      env.GIT_BRANCH = scmInfo.GIT_BRANCH
      env.GIT_COMMIT = scmInfo.GIT_COMMIT
    }

    stage('Build') {
      withCredentials([
        usernamePassword(credentialsId: '063fc85b-62a6-4181-9d72-873b43488411', usernameVariable: 'AWS_ACCESS_KEY_ID', passwordVariable: 'AWS_SECRET_ACCESS_KEY'),
        string(credentialsId: 'a791118f-a1ea-46cd-b876-56da1b9bc71c',variable: 'NEXUS_PASSWORD')
        ]) {
        sh '''\
        |#!/bin/bash -e
        |export GIT_BRANCH=${GIT_BRANCH}
        |export GIT_COMMIT=${GIT_COMMIT}
        |$WORKSPACE/ci/build.sh
        '''.stripMargin()
      }
    }
    params = [
      string(name: 'svn_revision', value: 'master'),
      string(name: 'branch', value: 'master'),
      string(name: 'client_git_commit', value: scmInfo.GIT_COMMIT),
      string(name: 'client_git_branch', value: scmInfo.GIT_BRANCH),
      string(name: 'TARGET_DOCKER_TEST_IMAGE', value: 'nodejs-centos6-default'),
      string(name: 'parent_job', value: env.JOB_NAME),
      string(name: 'parent_build_number', value: env.BUILD_NUMBER)
    ]
    stage('Test') {
      build job: 'RT-LanguageNodeJS-PC',parameters: params
    }
  }
}
