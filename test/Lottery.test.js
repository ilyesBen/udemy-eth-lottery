const assert = require("assert");
const ganache = require("ganache-cli");
const Web3 = require("web3");

const web3 = new Web3(ganache.provider());

const { interface, bytecode } = require("../compile");

let accounts;
let lottery;

beforeEach(async () => {
  accounts = await web3.eth.getAccounts();

  lottery = await new web3.eth.Contract(JSON.parse(interface))
    .deploy({ data: bytecode })
    .send({ from: accounts[0], gas: "1000000" });
});

describe("Lottery Contract", () => {
  it("deploys a contract", () => {
    assert.ok(lottery.options.address);
  });

  it("allows one account to enter", async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei("0.02", "ether"),
    });

    const players = await lottery.methods
      .getPlayers()
      .call({ from: accounts[0] });

    assert.equal(accounts[0], players[0]);
    assert.equal(1, players.length);
  });

  it("allows multiple accounts to enter the lottery", async () => {
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei("0.02", "ether"),
    });

    await lottery.methods.enter().send({
      from: accounts[1],
      value: web3.utils.toWei("0.02", "ether"),
    });

    await lottery.methods.enter().send({
      from: accounts[2],
      value: web3.utils.toWei("0.02", "ether"),
    });

    const players = await lottery.methods
      .getPlayers()
      .call({ from: accounts[0] });

    assert.equal(accounts[0], players[0]);
    assert.equal(accounts[1], players[1]);
    assert.equal(accounts[2], players[2]);
    assert.equal(3, players.length);
  });

  it("requires a minimum amount of ether", async () => {
    let executed;
    try {
      await lottery.methods.enter().send({
        from: accounts[0],
        value: 0,
      });
      executed = "success";
    } catch (err) {
      executed = "fail";
    }

    assert.equal(executed, "fail");
  });

  it("only manager can pick winner", async () => {
    // Enter lottery first so that players array is not empty
    await lottery.methods.enter().send({
      from: accounts[0],
      value: web3.utils.toWei("0.02", "ether"),
    });

    let executed;

    try {
      await lottery.methods.pickWinner().send({
        from: accounts[1],
      });
      executed = "success";
    } catch (err) {
      executed = "fail";
    }

    assert.equal("fail", executed);
  });

  it("send money to the winner and resets the players array", async () => {
    await lottery.methods.enter().send({
      from: accounts[1],
      value: web3.utils.toWei("2", "ether"),
    });

    const initialBalance = await web3.eth.getBalance(accounts[1]);

    await lottery.methods.pickWinner().send({ from: accounts[0] });

    const finalBalance = await web3.eth.getBalance(accounts[1]);

    const diff = finalBalance - initialBalance;

    assert(diff === Number(web3.utils.toWei("2", "ether")));

    // players array is empty
    const players = await lottery.methods
      .getPlayers()
      .call({ from: accounts[0] });

    assert.equal(players.length, 0);

    // lottery has a balance of 0
    const contractBalance = await web3.eth.getBalance(lottery.options.address);

    assert.equal(contractBalance, 0);
  });
});
