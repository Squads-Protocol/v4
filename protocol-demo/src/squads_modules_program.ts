export type SquadsModulesProgram = {
  "version": "0.1.0",
  "name": "squads_modules_program",
  "instructions": [
    {
      "name": "createModulesManager",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createModulesManagerWithConfigTransaction",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "configTransaction",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "addModule",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "multisig",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "module",
          "type": {
            "defined": "Module"
          }
        }
      ]
    },
    {
      "name": "executeVaultTransaction",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultTransaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "multisig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "executeModuleVaultTransaction",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultTransaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "executeConfigTransaction",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "configTransaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "modulesManager",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "modules",
            "type": {
              "vec": {
                "defined": "Module"
              }
            }
          },
          {
            "name": "configAuthorities",
            "type": {
              "vec": "publicKey"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Module",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "program",
            "type": "publicKey"
          },
          {
            "name": "discriminator",
            "type": "bytes"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ModuleManagerInactive",
      "msg": "The module manager is inactive."
    },
    {
      "code": 6001,
      "name": "MissingModuleAccount",
      "msg": "A required module account is missing."
    }
  ]
};

export const IDL: SquadsModulesProgram = {
  "version": "0.1.0",
  "name": "squads_modules_program",
  "instructions": [
    {
      "name": "createModulesManager",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createModulesManagerWithConfigTransaction",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "configTransaction",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "addModule",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "multisig",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "module",
          "type": {
            "defined": "Module"
          }
        }
      ]
    },
    {
      "name": "executeVaultTransaction",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultTransaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "multisig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "executeModuleVaultTransaction",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultTransaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "executeConfigTransaction",
      "accounts": [
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "modulesManager",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "configTransaction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "squadsProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "multisig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "modulesManager",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "modules",
            "type": {
              "vec": {
                "defined": "Module"
              }
            }
          },
          {
            "name": "configAuthorities",
            "type": {
              "vec": "publicKey"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Module",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "program",
            "type": "publicKey"
          },
          {
            "name": "discriminator",
            "type": "bytes"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ModuleManagerInactive",
      "msg": "The module manager is inactive."
    },
    {
      "code": 6001,
      "name": "MissingModuleAccount",
      "msg": "A required module account is missing."
    }
  ]
};
