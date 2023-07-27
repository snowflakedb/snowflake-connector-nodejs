import os
f = open("test/integration/testConnection.js", "r")
data = f.read()
data = data.replace("describe(", "describe.skip(")
data = data.replace("describe.skip('Connection test - external browser'", "describe('Connection test - external browser'")
data = data.replace("describe.skip('Connection test - oauth'", "describe('Connection test - oauth'")
data = data.replace("describe.skip('Connection test - okta'", "describe('Connection test - okta'")
data = data.replace("const connOption = require('./connectionOptions');", "const connOption = require('../integration/connectionOptions');")
data = data.replace("const testUtil = require('./testUtil');", "const testUtil = require('../integration/testUtil');")

if not os.path.exists('test/manual'):
   os.makedirs('test/manual')

f = open("test/manual/testConnection.js", "w")
f.write(data)