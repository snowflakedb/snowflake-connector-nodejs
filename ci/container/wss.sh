#!/usr/bin/env bash
#
# Run whitesource for NodeJS driver
#
set -e
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

[[ -z "$WHITESOURCE_API_KEY" ]] && echo "[WARNING] No WHITESOURCE_API_KEY is set. No WhiteSource scan will occur." && exit 0

export PRODUCT_NAME=snowflake-connector-nodejs
export PROJECT_NAME=snowflake-connector-nodejs

DATE=$(date +'%m-%d-%Y')

SCAN_DIRECTORIES=$(cd $THIS_DIR/../.. && pwd)

rm -f wss-unified-agent.jar 
curl -LO https://github.com/whitesource/unified-agent-distribution/releases/latest/download/wss-unified-agent.jar

SCAN_CONFIG=wss-nodejs-agent.config
cat > $SCAN_CONFIG <<CONFIG
###############################################################
# WhiteSource Unified-Agent configuration file
###############################################################
# NPM SCAN MODE: package.json (or package-lock.json)
###############################################################

apiKey=
#userKey is required if WhiteSource administrator has enabled "Enforce user level access" option
#userKey=
#requesterEmail=user@provider.com

projectName=
projectVersion=
projectToken=
#projectTag= key:value

productName=
productVersion=
productToken=

#projectPerFolder=true
#projectPerFolderIncludes=
#projectPerFolderExcludes=

#wss.connectionTimeoutMinutes=60
wss.url=https://saas.whitesourcesoftware.com/agent

############
# Policies #
############
checkPolicies=true
forceCheckAllDependencies=false
forceUpdate=false
forceUpdate.failBuildOnPolicyViolation=false
#updateInventory=false

###########
# General #
###########
#offline=false
#updateType=APPEND
#ignoreSourceFiles=true
#scanComment=
#failErrorLevel=ALL
#requireKnownSha1=false

#generateProjectDetailsJson=true
#generateScanReport=true
#scanReportTimeoutMinutes=10
#scanReportFilenameFormat=

#analyzeFrameworks=true
#analyzeFrameworksReference=

#updateEmptyProject=false

#log.files.level=
#log.files.maxFileSize=
#log.files.maxFilesCount=
#log.files.path=

########################################
# Package Manager Dependency resolvers #
########################################
resolveAllDependencies=false

npm.resolveDependencies=true
npm.ignoreSourceFiles=true
npm.includeDevDependencies=false
npm.runPreStep=false
npm.ignoreNpmLsErrors=true
npm.ignoreScripts=true
npm.yarnProject=false
npm.accessToken=
npm.identifyByNameAndVersion=false
npm.yarn.frozenLockfile=false
npm.resolveMainPackageJsonOnly=true
npm.removeDuplicateDependencies=true
npm.resolveAdditionalDependencies=false
npm.failOnNpmLsErrors = false
# npm.projectNameFromDependencyFile = true
npm.resolveGlobalPackages=true                             
npm.resolveLockFile=false

###########################################################################################
# Includes/Excludes Glob patterns - Please use only one exclude line and one include line #
###########################################################################################
includes=**/*.m **/*.mm **/*.js **/*.json **/*.ts **/*.jsx **/*.tsx **/*.min.js

#Exclude file extensions or specific directories by adding **/*.<extension> or **/<excluded_dir>/**
excludes=**/*sources.jar **/*javadoc.jar

case.sensitive.glob=false
followSymbolicLinks=true
CONFIG

echo "[INFO] Running wss.sh for ${PROJECT_NAME}-${PRODUCT_NAME} under ${SCAN_DIRECTORIES}"
java -jar wss-unified-agent.jar -apiKey ${WHITESOURCE_API_KEY} \
    -c ${SCAN_CONFIG} \
    -project ${PROJECT_NAME} \
    -product ${PRODUCT_NAME} \
    -d ${SCAN_DIRECTORIES} \
    -wss.url https://saas.whitesourcesoftware.com/agent \
    -offline true

if java -jar wss-unified-agent.jar -apiKey ${WHITESOURCE_API_KEY} \
   -c ${SCAN_CONFIG} \
   -project ${PROJECT_NAME} \
   -product ${PRODUCT_NAME} \
   -projectVersion baseline \
   -requestFiles whitesource/update-request.txt \
   -wss.url https://saas.whitesourcesoftware.com/agent ; then
    echo "checkPolicies=false" >> ${SCAN_CONFIG}
    java -jar wss-unified-agent.jar -apiKey ${WHITESOURCE_API_KEY} \
        -c ${SCAN_CONFIG} \
        -project ${PROJECT_NAME} \
        -product ${PRODUCT_NAME} \
        -projectVersion ${DATE} \
        -requestFiles whitesource/update-request.txt \
        -wss.url https://saas.whitesourcesoftware.com/agent
fi

# not ever
exit 0
