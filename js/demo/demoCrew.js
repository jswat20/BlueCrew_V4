const demoCrewData = (() => {

  const crew = [

    // your four crew members

  ];

  function getAll() {
    return JSON.parse(JSON.stringify(crew));
  }

  return {
    getAll
  };

})();